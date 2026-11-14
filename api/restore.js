export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const { imageBase64, mimeType } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({ error: '未收到圖片資料' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: '尚未設定 GEMINI_API_KEY' });
  }

  const prompt = `你是一個專業的試卷圖像修復專家。請嚴格執行以下五步處理，將這張已作答的工作紙照片還原為一張乾淨、可直接列印的空白練習紙：
1. 【擦除手寫答案】：徹底擦除所有鉛筆、黑筆、藍筆手寫填寫的英文單字、中文、手寫編號數字及手寫塗改，在原填寫位置留下乾淨完整的空白橫線（不要把原本的印刷填空底線擦斷）。
2. 【擦除紅筆與彩色批改】：徹底清除所有紅圈、手畫黑/鉛筆圈選、紅勾（✓）、紅叉（✗）、括號、箭頭、紅色批注字、分數及彩色下劃線，完整保留原本被圈住的印刷單字。
3. 【保留印刷內容與版式】：100% 完整保留所有黑色印刷體題目、標題、表格框線、獨立黑框與黑白線稿插圖，所有位置、排版與字體內容必須與原圖完全一致，絕不重排或改寫任何題目。
4. 【去拍攝效果與白底淨化】：消除相機拍攝產生的陰影、光影不均、紙張褶皺、污漬與泛黃，將所有非文字/非線框/非插圖的背景區域提亮為均勻的 100% 純白色（#FFFFFF），框內保持純白無灰底。
5. 【文字與線框增強】：讓保留下來的黑色印刷文字、填空橫線、表格框線與黑白插圖更加清晰、實色、深黑且邊緣銳利。`;

  // 優先使用支援原生圖像編輯輸出的多模态模型
  const imageEditModels = [
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp-image-generation',
  ];

  let lastError = '圖像編輯模型暫時繁忙，請稍後再試';

  for (const model of imageEditModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastError = data?.error?.message || `API 錯誤 (${response.status})`;
        continue;
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);

      if (!imgPart) {
        lastError = '模型未回傳編輯後的圖片，請重試';
        continue;
      }

      return res.status(200).json({
        success: true,
        modelUsed: model,
        restoredBase64: imgPart.inlineData.data,
        mimeType: imgPart.inlineData.mimeType || 'image/png',
      });
    } catch (err) {
      lastError = String(err.message || err);
    }
  }

  return res.status(502).json({ error: lastError });
}
