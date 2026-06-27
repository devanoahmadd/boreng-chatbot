// Konfigurasi terpusat. Default sudah aman; .env hanya untuk override.
// Catatan: dibaca dari process.env, jadi server.js WAJIB `import 'dotenv/config'` paling atas.
const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const SESSION_TTL_MIN = num(process.env.SESSION_TTL_MIN, 30);
export const CLEANUP_INTERVAL_MIN = num(process.env.CLEANUP_INTERVAL_MIN, 10);
export const RATE_LIMIT_PER_MIN = num(process.env.RATE_LIMIT_PER_MIN, 15);
export const MAX_INPUT_CHARS = num(process.env.MAX_INPUT_CHARS, 2000);
export const GEMINI_TIMEOUT_MS = num(process.env.GEMINI_TIMEOUT_MS, 30000);
export const GEMINI_MAX_RETRY = num(process.env.GEMINI_MAX_RETRY, 1);
