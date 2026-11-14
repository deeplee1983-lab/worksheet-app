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

  try {
    const prompt = `你是一個專為香港中小學家長服務的工作紙還原專家。請仔細觀察這張已作答的工作紙照片，區分「原本印刷的題目與版面」和「學生手寫答案（鉛筆/原子筆）及老師紅筆批改」。
請嚴格遵循以下規則，將這份工作紙的「純空白原始印刷內容」完整還原出來，並以純 JSON 格式輸出（不要加 markdown 標記）：
1. 徹底刪除所有學生手寫填入的答案、數字、英文字母、中文字、塗改液痕跡，以及老師的紅筆剔號、交叉、分數與評語，將填寫位置還原為乾淨的空白底線（例如：________）或空白方格。
2. 完整保留原本印刷的標題、題號、指示語、英文/中文句子、選項表格（例如詞彙表）及頁碼。
3. 格式必須為合法 JSON：
{
  "sectionTitle": "大標題（例如：B. Grammar practice:）",
  "instruction": "題目指示語（例如：What can we do at school? Complete the sentences.）",
  "questions": [
    {
      "num": "1.",
      "lines": ["We can ____________________", "in the library."]
    }
  ],
  "wordBoxes": [
    {
      "boxTitle": "詞彙表標題（如 Places at school，若無則留空）",
      "columns": 3,
      "items": ["an art room", "a classroom", "a computer room"]
    }
  ],
  "footer": "頁尾頁碼（如 P.2，若無則留空）"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
          },
        }),
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `API 錯誤 (${response.status})`,
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);

    return res.status(200).json({
      success: true,
      worksheet: parsed,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.name === 'AbortError' ? 'AI 分析逾時，請再試一次' : String(err.message || err),
    });
  }
}
