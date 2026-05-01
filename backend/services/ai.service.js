const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildLocalReply(message) {
  return [
    'I can help with that. Configure GEMINI_API_KEY to enable live AI responses.',
    `For now, here is a demo response to: "${message}"`,
  ].join(' ');
}

export async function generateChatReply(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'YOUR_API_KEY') {
    return {
      reply: buildLocalReply(message),
      provider: 'local-fallback',
    };
  }

  const response = await fetch(`${GEMINI_API_BASE_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'You are a concise interview-demo chatbot for a student mini project.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: message,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI provider failed with ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    reply: reply || buildLocalReply(message),
    provider: 'gemini',
  };
}
