
import { GoogleGenAI, Type } from "@google/genai";
import { Caption } from "../types";

// Initialize the API client
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Transcribes audio into timestamped captions.
 */
export async function transcribeAudio(audioBase64: string, signal?: AbortSignal): Promise<Caption[]> {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";

  const prompt = `Transcribe the provided audio. Return the response as a JSON array of objects.
Each object must have:
- start: (number) start time in seconds
- end: (number) end time in seconds
- text: (string) the transcribed text
Ensure the timestamps are precise. Respond ONLY with valid JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "audio/wav", data: audioBase64 } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
            text: { type: Type.STRING },
          },
          required: ["start", "end", "text"]
        }
      }
    }
  });

  const rawJson = response.text || "[]";
  const data = JSON.parse(rawJson);
  
  return data.map((item: any, index: number) => ({
    id: `caption-${index}`,
    ...item
  }));
}

/**
 * Translates existing captions into a target language.
 */
export async function translateCaptions(captions: Caption[], targetLanguage: string, signal?: AbortSignal): Promise<Caption[]> {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";

  const prompt = `Translate the following captions into ${targetLanguage}. 
Keep the timestamps exactly the same.
Return a JSON array of objects with 'id', 'start', 'end', and 'text'.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ 
      parts: [
        { text: prompt },
        { text: JSON.stringify(captions) }
      ] 
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
            text: { type: Type.STRING },
          },
          required: ["id", "start", "end", "text"]
        }
      }
    }
  });

  const rawJson = response.text || "[]";
  return JSON.parse(rawJson);
}

/**
 * Generates speech for a given text.
 */
export async function generateSpeech(text: string, signal?: AbortSignal): Promise<string> {
  const ai = getAiClient();
  const model = "gemini-2.5-flash-preview-tts";

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    }
  });

  const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) {
    throw new Error("Failed to generate speech: No audio data returned.");
  }

  return audioBase64;
}
