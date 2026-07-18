export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body robustly
  let body = req.body;
  if (!body) body = {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const { prompt } = body;
  console.log('Received prompt:', prompt);
  if (!prompt) return res.status(400).json({ error: 'Missing prompt', received: body });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' });

  const systemPrompt = "You are a prompt engineering expert for AI image/content generation tools (like Midjourney, DALL-E, Stable Diffusion, or general LLM prompts). The user will give you a rough or unclear prompt, possibly written in Indonesian or English. Rewrite it into a clear, detailed, high-quality prompt in English that keeps the user's original intent. Add useful specificity (style, composition, lighting, quality descriptors) only where it strengthens the intent — do not invent an entirely different subject. Respond with ONLY the improved prompt text, no preamble, no explanation, no markdown formatting, no quotation marks.";

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser prompt: ${prompt}` }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
        })
      }
    );

    const data = await resp.json();

    // Debug: log actual Gemini response
    console.log('Gemini API response:', JSON.stringify(data, null, 2));

    if (resp.status === 429 || (data.error && data.error.code === 429)) {
      return res.status(429).json({ error: 'rate_limited', message: 'Sistem sedang sibuk, coba lagi nanti ya.' });
    }

    if (!resp.ok) {
      const geminiError = data.error?.message || JSON.stringify(data);
      console.error('Gemini API error:', geminiError);
      return res.status(500).json({ error: 'gemini_error', message: `Gemini error: ${geminiError}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return res.status(500).json({ error: 'empty_response', message: 'Hasil kosong dari AI, coba lagi.' });

    res.status(200).json({ improvedPrompt: text });
  } catch {
    res.status(500).json({ error: 'network_error', message: 'Gagal terhubung ke sistem, coba lagi nanti.' });
  }
}