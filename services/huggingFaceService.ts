
import { Caption } from "../types";

const HF_TOKEN = process.env.API_KEY || "";

/**
 * Generic fetch for Hugging Face Inference API
 */
async function queryHF(model: string, data: any, isBinary: boolean = false) {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      headers: { 
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": isBinary ? "application/octet-stream" : "application/json"
      },
      method: "POST",
      body: data,
    }
  );
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown HF Error" }));
    throw new Error(err.error || `Hugging Face API Error: ${response.statusText}`);
  }
  
  return isBinary ? await response.blob() : await response.json();
}

/**
 * Transcribes audio into timestamped captions using Whisper V3.
 */
export async function transcribeAudio(audioBase64: string, signal?: AbortSignal): Promise<Caption[]> {
  // Convert base64 back to binary for HF
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const result = await queryHF("openai/whisper-large-v3", bytes, true);

  // Whisper returns chunks with timestamps if return_timestamps=true is passed 
  // (Note: The default inference endpoint behavior can vary, but large-v3 usually provides segments)
  if (!result.chunks) {
     // Fallback if chunks aren't returned: create one big segment
     return [{
       id: "cap-0",
       start: 0,
       end: 10, // Mock duration
       text: result.text || "No transcription available."
     }];
  }

  return result.chunks.map((chunk: any, index: number) => ({
    id: `caption-${index}`,
    start: chunk.timestamp[0] || 0,
    end: chunk.timestamp[1] || (chunk.timestamp[0] + 2),
    text: chunk.text.trim()
  }));
}

/**
 * Translates captions using NLLB-200.
 */
export async function translateCaptions(captions: Caption[], targetLanguage: string, signal?: AbortSignal): Promise<Caption[]> {
  const translatedCaptions: Caption[] = [];
  
  // To avoid hitting payload limits, we translate each caption or batch them.
  // For simplicity and accuracy in this studio, we'll process them in sequence.
  for (const cap of captions) {
    const result = await queryHF("facebook/nllb-200-distilled-600M", {
      inputs: cap.text,
      parameters: {
        // Mapping simple language names to NLLB codes would happen here
        // For now, we use a generic translation flow.
        tgt_lang: "eng_Latn" 
      }
    });
    
    translatedCaptions.push({
      ...cap,
      text: result[0]?.translation_text || cap.text
    });
  }
  
  return translatedCaptions;
}

/**
 * Generates speech using MMS TTS.
 */
export async function generateSpeech(text: string, signal?: AbortSignal): Promise<string> {
  // MMS Models are language specific, using English (eng) as default for the demo
  const blob = await queryHF("facebook/mms-tts-eng", { inputs: text }, false);
  
  // Convert Blob to Base64 to match the app's existing pipeline
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
