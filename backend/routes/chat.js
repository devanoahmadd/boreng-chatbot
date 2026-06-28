// Endpoint chat: rate limit + validasi input + SSE streaming + jaminan kontak darurat.
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getHistory, saveHistory } from '../utils/session.js';
import { streamReply } from '../services/gemini.js';
import { checkCrisis, mentionsCrisisContact, CRISIS_CONTACT_TEXT } from '../config/safety.js';
import { RATE_LIMIT_PER_MIN, MAX_INPUT_CHARS } from '../config/constants.js';

const router = express.Router();

// Header standar SSE.
function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}

// Kirim satu event SSE. Guard: jangan menulis setelah response ditutup
// (mis. chunk telat dari stream yang sudah timeout) agar server tidak crash.
function sseSend(res, obj) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// Rate limit per sessionId (fallback IP). Respons ramah dalam format SSE.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.sessionId || ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.writeHead(200, sseHeaders());
    sseSend(res, { error: 'Pelan-pelan ya, kita ngobrol bareng kok. Coba lagi sebentar lagi 💙' });
    res.end();
  },
});

router.post('/chat', chatLimiter, async (req, res) => {
  const { sessionId, message } = req.body || {};

  // Validasi dasar.
  if (!sessionId || typeof message !== 'string' || !message.trim()) {
    res.writeHead(200, sseHeaders());
    sseSend(res, { error: 'Pesannya kosong nih. Cerita aja apa yang lagi lo rasain.' });
    return res.end();
  }

  // Batas panjang input.
  if (message.length > MAX_INPUT_CHARS) {
    res.writeHead(200, sseHeaders());
    sseSend(res, { error: `Pesannya kepanjangan (maks ${MAX_INPUT_CHARS} karakter). Coba ringkas dikit ya.` });
    return res.end();
  }

  res.writeHead(200, sseHeaders());

  // Hitung sinyal krisis di awal: jaminan kontak darurat HARUS independen
  // dari sukses/gagalnya Gemini (Bagian 4/5/13 CLAUDE.md).
  const isCrisis = checkCrisis(message);
  // Akumulasi balasan model untuk dedup kontak darurat.
  let replyText = '';

  try {
    const history = getHistory(sessionId);

    const updatedHistory = await streamReply({
      history,
      message,
      onChunk: (piece) => {
        replyText += piece;
        sseSend(res, { text: piece });
      },
    });

    saveHistory(sessionId, updatedHistory);
  } catch (err) {
    console.error('Gagal stream Gemini:', err);
    sseSend(res, { error: 'Maaf, Boreng lagi susah mikir bentar. Coba kirim lagi ya 💙' });
  } finally {
    // Jaring pengaman: kontak darurat DIJAMIN muncul walau Gemini gagal.
    // Dedup: lewati kalau balasan model sudah memuat rujukan kontak darurat
    // (mis. model sudah menyebut SEJIWA/Into The Light). Saat Gemini gagal,
    // replyText kosong → blok tetap terkirim (jaminan tetap utuh).
    if (isCrisis && !mentionsCrisisContact(replyText)) {
      sseSend(res, { text: CRISIS_CONTACT_TEXT });
    }
    sseSend(res, { done: true });
    res.end();
  }
});

export default router;
