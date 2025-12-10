// api/generate.js

export default async function handler(req, res) {
    // 1. Solo permitimos peticiones POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const { prompt, imageBase64 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; // ¡La llave se lee del servidor!
  
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key not configured' });
    }
  
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
  
      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
          ]
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
        }
      };
  
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
  
      const data = await response.json();
      
      // Retornamos la respuesta de Google tal cual al frontend
      res.status(200).json(data);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error generating image' });
    }
  }