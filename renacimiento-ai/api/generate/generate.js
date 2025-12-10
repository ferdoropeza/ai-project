// api/generate/generate.js

export default async function handler(req, res) {
    // 1. Solo permitimos peticiones POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const { prompt, imageBase64 } = req.body;
    // Asegúrese de que esta variable esté configurada en Vercel
    const apiKey = process.env.GEMINI_API_KEY; 
  
    if (!apiKey) {
      // Este error ya no debería ocurrir si se configuró la variable
      return res.status(500).json({ error: 'API Key not configured in Vercel environment' });
    }
  
    try {
      // Modelo optimizado para Image-to-Image / generación de imagen
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
  
      // --- PASO 1: VERIFICAR SI LA LLAMADA A GOOGLE FALLÓ (400, 500) ---
      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Error de la API de Google:", JSON.stringify(errorBody, null, 2));
        // Devolver un error 500 para el frontend, incluyendo el mensaje de Google
        return res.status(500).json({ 
            error: "Google API Request Failed", 
            details: errorBody.error?.message || "Check Vercel logs for API error." 
        });
      }
  
      // La respuesta es 200 OK
      const data = await response.json();

      // --- PASO 2: VERIFICAR SI FUE BLOQUEADO POR SEGURIDAD (SAFETY FILTER) ---
      const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      
      if (!imagePart) {
          // Si no hay parte de imagen, es casi siempre un filtro de seguridad.
          console.warn("Imagen bloqueada por filtro de seguridad de Gemini:");
          console.warn(JSON.stringify(data.promptFeedback, null, 2));
          
          let blockReason = "Contenido bloqueado por las políticas de seguridad de Gemini.";
          const safetyRatings = data.promptFeedback?.safetyRatings;
          if (safetyRatings && safetyRatings.length > 0) {
              const blockedCategories = safetyRatings
                  .filter(r => r.probability !== "NEGLIGIBLE" && r.probability !== "LOW")
                  .map(r => r.category.replace('HARM_CATEGORY_', ''));
              if (blockedCategories.length > 0) {
                  blockReason = `Generación bloqueada. Razones: ${blockedCategories.join(', ')}. Intenta con una foto menos sensible.`;
              }
          }

          // Enviar un mensaje de error claro al frontend
          return res.status(200).json({ 
              error: true,
              message: blockReason, 
              data: null 
          });
      }

      // --- PASO 3: ÉXITO ---
      // Retornamos la respuesta de Google tal cual al frontend
      res.status(200).json(data);
  
    } catch (error) {
      console.error("Error de ejecución en Vercel:", error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
}
