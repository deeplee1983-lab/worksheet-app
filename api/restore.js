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
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器尚未設定 GEMINI_API_KEY 環境變數' });
  }

  try {
    const { imageBase64, mimeType, options } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: '未收到圖片資料' });
    }

    // 呼叫免費版額度充足的 gemini-2.5-flash 進行版面與題目結構分析
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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
                  text: "Analyze this worksheet briefly in Traditional Chinese (Hong Kong): list the main title and confirm how many questions are detected. Keep it under 50 words.",
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `Google API 錯誤 (${response.status})`,
      });
    }

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || '已完成工作紙版面識別';

    return res.status(200).json({
      mode: 'client-filter',
      summary,
      options: options || {},
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
