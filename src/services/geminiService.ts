/**
 * Service to call Gemini API directly using REST fetch
 */
export async function generateGeminiReport(apiKey: string, promptContent: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: promptContent,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for factual consistency in analytics reports
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error?.message || `Lỗi HTTP: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    throw new Error('Gemini không trả về nội dung hợp lý. Kiểm tra định dạng dữ liệu.');
  }

  return generatedText;
}
export function getSavedApiKey(): string {
  return localStorage.getItem('gemini_api_key') || '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem('gemini_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('gemini_api_key');
}
