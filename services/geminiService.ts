
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const callGeminiWithRetry = async (
  prompt: string,
  systemInstruction: string,
  retries = 3,
  backoff = 1000
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    return response.text || "無法取得 AI 回應。";
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
      console.warn(`Gemini API Error: ${error.message}. Retrying in ${backoff}ms...`);
      await wait(backoff);
      return callGeminiWithRetry(prompt, systemInstruction, retries - 1, backoff * 2);
    }
    console.error("Gemini API Final Error:", error);
    return `連線錯誤: ${error.message || "未知原因"}`;
  }
};
