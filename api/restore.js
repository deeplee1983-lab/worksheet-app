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
  const { imageBase64, mimeType, options } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({ error: '未收到圖片資料' });
  }

  let summary = '已完成工作紙去紅筆、淡化鉛筆及純白省墨處理';

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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
                  {
                    text: "Analyze this worksheet briefly in Traditional Chinese (Hong Kong): state the main title and how many questions are detected. Keep it under 50 words.",
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        summary = data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      // 若 API 暫時超時，仍繼續放行本地省墨還原引擎，不中斷使用
    }
  }

  return res.status(200).json({
    mode: 'client-filter',
    summary,
    options: options || {},
  });
}
