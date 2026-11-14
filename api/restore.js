export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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

  const prompt = `分析這張工作紙照片。區分「原版印刷題目」與「學生手寫填充答案及老師紅筆批改」。
將所有學生手寫填入的英文單字、句子、數字、塗改及老師批改徹底刪除，把填寫位置還原為乾淨的底線（如 ________），完整保留原版印刷的標題、題號、指示語、句子、詞彙表及頁碼。
只輸出純 JSON（不加任何說明文字）：
{
  "sectionTitle": "大標題（如 B. Grammar practice:）",
  "instruction": "指示語（如 What can we do at school? Complete the sentences.）",
  "questions": [
    { "num": "1.", "lines": ["We can ____________________", "in the library."] }
  ],
  "wordBoxes": [
    { "boxTitle": "詞彙表標題（如 Places at school）", "columns": 3, "items": ["an art room", "a classroom", "a computer room"] }
  ],
  "footer": "頁尾（如 P.2）"
}`;

  // 依序嘗試多個免費模型，遇到單一模型流量高峰自動切換下一個
  const candidateModels = [
    'gemini-3.8-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
  ];

  let lastError = '所有 AI 伺服器目前皆處於高負載狀態，請稍等幾秒再試';

  for (const model of candidateModels) {
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
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastError = data?.error?.message || `API 錯誤 (${response.status})`;
        continue; // 塞車或不可用時，立即嘗試下一個模型
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText);

      return res.status(200).json({
        success: true,
        modelUsed: model,
        worksheet: parsed,
      });
    } catch (err) {
      lastError = String(err.message || err);
    }
  }

  return res.status(503).json({ error: lastError });
}
