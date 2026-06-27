// Integrasi Gemini via @google/genai (SDK baru). Streaming + timeout + retry.
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from '../config/prompt.js';
import { GEMINI_TIMEOUT_MS, GEMINI_MAX_RETRY } from '../config/constants.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Bungkus sebuah promise dengan timeout.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${label} setelah ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Apakah error transient (layak retry)?
function isTransient(err) {
  const msg = String(err?.message || err).toLowerCase();
  const status = err?.status ?? err?.code;
  if (typeof status === 'number' && status >= 500) return true;
  return /timeout|network|fetch failed|econnreset|etimedout|unavailable|overloaded|50[023]/.test(msg);
}

// Stream balasan Boreng. onChunk dipanggil tiap potongan teks.
// Mengembalikan history terbaru untuk disimpan ke session.
export async function streamReply({ history, message, onChunk }) {
  let lastErr;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRY; attempt++) {
    let emitted = false;
    try {
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.9 },
        history,
      });

      const stream = await withTimeout(
        chat.sendMessageStream({ message }),
        GEMINI_TIMEOUT_MS,
        'sendMessageStream',
      );

      for await (const chunk of stream) {
        const piece = chunk.text;
        if (piece) {
          emitted = true;
          onChunk(piece);
        }
      }

      return chat.getHistory();
    } catch (err) {
      lastErr = err;
      // Hanya retry kalau belum ada teks terkirim (hindari dobel) & error transient.
      if (!emitted && attempt < GEMINI_MAX_RETRY && isTransient(err)) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}
