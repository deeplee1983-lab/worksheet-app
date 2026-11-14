import { GoogleGenAI } from '@google/genai';

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

  const rawKey = process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.trim();
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器尚未設定 GEMINI_API_KEY 環境變數' });
  }

  try {
    const { imageBase64, mimeType, options } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: '未收到圖片資料' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let rules = [
      "Identify all original printed worksheet questions, instructions, illustrations, answer lines, and boxes, and preserve them accurately.",
      "Completely remove and erase all handwritten student answers (pencil/pen) and all teacher red-pen corrections, checkmarks, crosses, circles, and scores, restoring the worksheet to a clean, unused blank state for re-practicing."
    ];

    if (options?.pureWhite) {
      rules.push("Remove all camera shadows, gray paper tint, creases, and background noise. Convert the entire background (both inside and outside any boxes) to 100% pure flat white (#FFFFFF) for maximum printer ink saving.");
    }
    if (options?.boldText) {
      rules.push("Render all printed text, numbers, and answer lines in crisp, dark, solid black so they print clearly even in ink-saving mode.");
    }
    if (options?.frameText) {
      rules.push("Draw clean, thin solid black rectangular frames around the main instruction titles and section headers, keeping the inside of every frame 100% pure white with no shading.");
    }
    if (options?.straighten) {
      rules.push("Remove any camera perspective tilt or distortion. Straighten and align all text lines, boxes, and horizontal answer lines so every line is completely level, evenly spaced, and well-proportioned on a flat vertical A4 layout.");
    }

    const prompt = `Edit this school worksheet image into a clean, printable blank A4 worksheet:\n- ` + rules.join("\n- ");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/jpeg',
          },
        },
        prompt,
      ],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart) {
      return res.status(500).json({ error: 'AI 未能生成圖片，請稍後再試或更換更清晰的照片' });
    }

    return res.status(200).json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    });
  } catch (err) {
    console.error('Restore API Error:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
