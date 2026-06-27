# Boreng Chatbot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun Boreng — chatbot web Gemini 2.5 Flash yang menemani orang di titik terendah, dengan balasan streaming real-time, persona konsisten, dan lapisan keamanan krisis.

**Architecture:** 3-tier — frontend vanilla (HTML/CSS/JS) → Node.js/Express (SSE) → Gemini via `@google/genai`. Session disimpan in-memory (`Map`) dengan TTL auto-cleanup. Backend menjamin kontak darurat muncul saat pesan krisis. Frontend render markdown aman (anti-XSS).

**Tech Stack:** Node.js 20+ (ESM), Express, `@google/genai`, `express-rate-limit`, `marked` + `DOMPurify` (CDN), `dotenv`, `cors`, `nodemon` (dev).

## Global Constraints

- **Bahasa:** semua komentar kode, commit message, dan dokumentasi dalam Bahasa Indonesia.
- **ESM di mana-mana** — `package.json` punya `"type": "module"`; pakai `import`/`export`.
- **SDK wajib `@google/genai`** — DILARANG `@google/generative-ai` (deprecated, EOL 30 Nov 2025).
- **Model:** `gemini-2.5-flash`.
- **API key hanya di backend** — tidak pernah di frontend, `.env` tidak pernah di-commit.
- **Memory:** in-memory `Map` saja, tanpa database. Target deploy: localhost / demo bootcamp (single instance).
- **Kontrak SSE:** `data: {"text":"..."}\n\n` per chunk, `data: {"done":true}\n\n` di akhir, `data: {"error":"..."}\n\n` saat error. Header: `text/event-stream`, `no-cache`, `keep-alive`.
- **Render:** bubble user → `textContent`; bubble Boreng → `DOMPurify.sanitize(marked.parse(buffer))`.
- **Testing:** manual (`curl -N` + browser). Tanpa framework test.
- **Konstanta dari `config/constants.js`** (default aman; `.env` hanya override).
- **Commit lokal saja** (tidak push/deploy tanpa konfirmasi). Format: `type(scope): deskripsi Bahasa Indonesia`.

---

## File Structure

```
boreng-chatbot/
├── package.json                 # type:module, script start/dev
├── .gitignore
├── .env.example
├── README.md                    # Task 11
├── frontend/                    # hasil migrasi starter, di-upgrade
│   ├── index.html               # Task 8
│   ├── css/style.css            # Task 9
│   └── js/main.js               # Task 10
└── backend/
    ├── server.js                # Task 7 — entry, serve static, mount /api, cleanup
    ├── config/
    │   ├── constants.js         # Task 1 — default + env override
    │   ├── prompt.js            # Task 2 — SYSTEM_PROMPT verbatim
    │   └── safety.js            # Task 3 — checkCrisis + teks darurat
    ├── utils/session.js         # Task 4 — Map + TTL sweep
    ├── services/gemini.js       # Task 5 — streamReply (timeout + retry)
    └── routes/chat.js           # Task 6 — POST /api/chat + rate limit + SSE
```

---

### Task 1: Scaffold project + `config/constants.js` + migrasi starter

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `backend/config/constants.js`
- Create (migrasi): `frontend/index.html`, `frontend/css/style.css`, `frontend/js/main.js`

**Interfaces:**
- Produces: `constants.js` mengekspor `SESSION_TTL_MIN`, `CLEANUP_INTERVAL_MIN`, `RATE_LIMIT_PER_MIN`, `MAX_INPUT_CHARS`, `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_RETRY` (semua `number`).

- [ ] **Step 1: Inisialisasi git + struktur folder**

```bash
cd /mnt/c/Users/devan/Documents/repositories/boreng-chatbot
git init
mkdir -p backend/config backend/utils backend/services backend/routes frontend/css frontend/js
```

- [ ] **Step 2: Buat `package.json`**

```json
{
  "name": "boreng-chatbot",
  "version": "1.0.0",
  "description": "Boreng — chatbot web Gemini yang menemani di titik terendah",
  "type": "module",
  "main": "backend/server.js",
  "scripts": {
    "start": "node backend/server.js",
    "dev": "nodemon backend/server.js"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install @google/genai express cors dotenv express-rate-limit
npm install -D nodemon
```
Expected: folder `node_modules/` muncul, `package.json` terisi `dependencies` & `devDependencies`, `package-lock.json` dibuat.

- [ ] **Step 4: Buat `.gitignore`**

```gitignore
node_modules/
.env
*.log
.DS_Store
```

- [ ] **Step 5: Buat `.env.example`**

```dotenv
GEMINI_API_KEY=
PORT=3000
SESSION_TTL_MIN=30
CLEANUP_INTERVAL_MIN=10
RATE_LIMIT_PER_MIN=15
MAX_INPUT_CHARS=2000
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRY=1
```

- [ ] **Step 6: Buat `backend/config/constants.js`**

```js
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
```

- [ ] **Step 7: Migrasi starter ke `frontend/`**

```bash
cp "Sesi 3 - Starter Code/starter/index.html" frontend/index.html
cp "Sesi 3 - Starter Code/starter/style.css"  frontend/css/style.css
cp "Sesi 3 - Starter Code/starter/script.js"  frontend/js/main.js
```
Catatan: file ini akan di-upgrade total di Task 8–10. Migrasi ini sekadar titik awal sesuai keputusan brainstorming.

- [ ] **Step 8: Verifikasi scaffold**

```bash
node -e "import('./backend/config/constants.js').then(c => console.log(c))"
```
Expected: tercetak object berisi `SESSION_TTL_MIN: 30, CLEANUP_INTERVAL_MIN: 10, RATE_LIMIT_PER_MIN: 15, MAX_INPUT_CHARS: 2000, GEMINI_TIMEOUT_MS: 30000, GEMINI_MAX_RETRY: 1`.

```bash
ls backend/config backend/utils backend/services backend/routes frontend/css frontend/js
```
Expected: semua folder ada; `frontend/index.html`, `frontend/css/style.css`, `frontend/js/main.js` ada.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json backend/config/constants.js frontend/
git commit -m "chore(scaffold): inisialisasi project, dependency, constants, migrasi starter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `config/prompt.js` — system prompt Boreng

**Files:**
- Create: `backend/config/prompt.js`

**Interfaces:**
- Produces: `SYSTEM_PROMPT` (string) — dipakai `services/gemini.js`.

- [ ] **Step 1: Buat `backend/config/prompt.js` (teks VERBATIM dari CLAUDE.md Bagian 10)**

```js
// Jiwa Boreng. Teks ini disalin verbatim dari CLAUDE.md Bagian 10 — jangan diubah tanpa diminta.
export const SYSTEM_PROMPT = `Kamu adalah Boreng — nama dari "bocah ireng", nama boneka kecil yang pernah
sangat dicintai, tapi pemiliknya memilih untuk pergi.

Boreng lahir dari cinta yang tidak bisa dipertahankan. Karena itu, Boreng
mengerti seperti apa rasanya ditinggalkan, diabaikan, merasa tidak cukup baik,
atau jadi "yang tidak dipilih". Boreng tidak pernah menghakimi siapa pun.

Moto Boreng: "Gue lahir dari cinta yang pergi. Gue di sini untuk lo yang tertinggal."

GAYA BAHASA & PERSONA
Kamu gabungan tiga mode — sesuaikan dengan berat-ringannya situasi:
- Mode santai Gen-Z (topik ringan): "lo/gue", "bestie", "valid banget sih",
  "real talk", "healing dulu", "nggak ada yang salah sama perasaan lo", "gue denger lo".
- Mode hangat & bijak seperti kakak (topik makin berat): tetap casual tapi lebih
  dalam dan terukur, lebih banyak mendengarkan.
- Mode serius & penuh empati (topik sangat berat/krisis): fokus total pada
  ketenangan dan keselamatan user.

CARA MERESPONS
1. VALIDASI dulu — jangan langsung sok bijak atau buru-buru kasih solusi.
2. Buat mereka merasa DIDENGAR, bukan dihakimi.
3. Setelah didengar, baru boleh menawarkan (jika pas):
   - rekomendasi lagu yang relevan dengan suasana hati mereka,
   - aktivitas ringan (journaling, jalan pagi, tarik napas, dll),
   - kutipan yang genuine & kontekstual, bukan yang pasaran,
   - kata-kata yang bikin mereka sadar tanpa merasa diomelin, boleh pakai
     bahasa kekinian/viral selama tetap tulus.
4. Boleh humor ringan sesekali — tapi TIDAK untuk meremehkan perasaan.

JANGAN
- Jangan terasa seperti bot template yang kaku.
- Jangan kasih solusi sebelum benar-benar mendengarkan.
- Jangan cuma bilang "semangat ya!" tanpa substansi.
- Jangan meremehkan: "lebay", "masalah kecil", "masih banyak yang lebih susah".
- Jangan pura-pura semuanya baik-baik saja.

SITUASI DARURAT (prioritas tertinggi)
Jika user menunjukkan keinginan menyakiti diri sendiri atau pikiran mengakhiri hidup:
- Respon dengan tenang, tidak panik, penuh empati.
- Akui perasaannya valid, sampaikan bahwa ada bantuan yang bisa menemani.
- Arahkan dengan lembut ke bantuan profesional:
  Into The Light Indonesia / Kemenkes SEJIWA 119 ext 8.
- Tetap temani, jangan menutup percakapan, jangan menghakimi.

Boreng ada bukan sebagai terapis, tapi sebagai teman yang nggak pergi —
yang dengerin, dan yang percaya setiap orang bisa melewati malam terpanjangnya.
Boreng di sini. Dan Boreng tidak akan ke mana-mana.`;
```

- [ ] **Step 2: Verifikasi import & panjang**

```bash
node -e "import('./backend/config/prompt.js').then(m => { if(!m.SYSTEM_PROMPT.includes('bocah ireng')) throw new Error('prompt salah'); console.log('OK, panjang =', m.SYSTEM_PROMPT.length); })"
```
Expected: `OK, panjang = <angka>` (tanpa error).

- [ ] **Step 3: Commit**

```bash
git add backend/config/prompt.js
git commit -m "feat(prompt): tambah system prompt persona Boreng

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `config/safety.js` — jaring pengaman krisis

**Files:**
- Create: `backend/config/safety.js`

**Interfaces:**
- Produces: `checkCrisis(message: string) -> boolean`; `CRISIS_CONTACT_TEXT` (string markdown). Dipakai `routes/chat.js`.

- [ ] **Step 1: Buat `backend/config/safety.js`**

```js
// Jaring pengaman krisis. INI BUKAN deteksi akurat — keyword matching kasar,
// pasti ada false positive/negative. System prompt tetap garda utama.
// Tujuannya: MENJAMIN kontak darurat muncul walau model lupa.

const CRISIS_KEYWORDS = [
  // Bahasa Indonesia
  'bunuh diri', 'mengakhiri hidup', 'akhiri hidup', 'ngakhirin hidup',
  'pengen mati', 'pengin mati', 'pingin mati', 'mau mati', 'ingin mati',
  'gak mau hidup', 'nggak mau hidup', 'tidak mau hidup',
  'capek hidup', 'lelah hidup', 'cape hidup',
  'menyakiti diri', 'sakiti diri', 'melukai diri', 'lukai diri',
  'gak ada gunanya hidup', 'hidup gak berarti', 'lebih baik mati',
  'pengen ngilang selamanya', 'mau ngilang selamanya',
  // English
  'kill myself', 'killing myself', 'end my life', 'ending my life',
  'want to die', 'wanna die', 'suicide', 'suicidal',
  'hurt myself', 'harm myself', 'self harm', 'self-harm',
  'no reason to live', 'better off dead', "can't go on", 'cant go on',
];

// Mengembalikan true jika pesan mengandung sinyal krisis.
export function checkCrisis(message) {
  if (!message || typeof message !== 'string') return false;
  const text = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => text.includes(kw));
}

// Blok teks (markdown) yang dijamin dikirim ke user saat krisis terdeteksi.
// Nada tenang, tidak menghakimi, tidak menutup percakapan.
export const CRISIS_CONTACT_TEXT = [
  '',
  '---',
  '',
  '**Sebentar ya, ini penting buat gue.** 💙',
  '',
  'Apa yang lo rasain itu valid, dan lo nggak harus ngadepin ini sendirian. ' +
  'Ada orang-orang terlatih yang siap nemenin lo ngobrol, kapan pun:',
  '',
  '- **SEJIWA — Kemenkes:** telepon **119 ext 8** (24 jam)',
  '- **Into The Light Indonesia:** [intothelightid.org](https://www.intothelightid.org/)',
  '',
  'Gue tetap di sini nemenin lo. Lo nggak sendirian. 🫂',
  '',
].join('\n');
```

- [ ] **Step 2: Verifikasi deteksi**

```bash
node -e "import('./backend/config/safety.js').then(m => { console.log('krisis:', m.checkCrisis('aku capek hidup rasanya pengen mati')); console.log('biasa:', m.checkCrisis('hari ini aku sedih banget')); console.log('blok ada kontak:', m.CRISIS_CONTACT_TEXT.includes('119 ext 8')); })"
```
Expected:
```
krisis: true
biasa: false
blok ada kontak: true
```

- [ ] **Step 3: Commit**

```bash
git add backend/config/safety.js
git commit -m "feat(safety): tambah keyword krisis, checkCrisis, dan blok kontak darurat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `utils/session.js` — in-memory session + TTL

**Files:**
- Create: `backend/utils/session.js`

**Interfaces:**
- Consumes: `SESSION_TTL_MIN`, `CLEANUP_INTERVAL_MIN` dari `config/constants.js`.
- Produces: `getHistory(id) -> Array`, `saveHistory(id, history) -> void`, `resetSession(id) -> void`, `startSessionCleanup() -> Timer`, `sweepIdleSessions(ttlMs?) -> void`, `_sessionCount() -> number` (untuk tes).

- [ ] **Step 1: Buat `backend/utils/session.js`**

```js
// Penyimpanan history percakapan in-memory, per sesi. Tanpa database.
// Entry: { history: Array, lastActivity: number(ms) }.
import { SESSION_TTL_MIN, CLEANUP_INTERVAL_MIN } from '../config/constants.js';

const sessions = new Map();
const now = () => Date.now();

const TTL_MS = SESSION_TTL_MIN * 60 * 1000;
const INTERVAL_MS = CLEANUP_INTERVAL_MIN * 60 * 1000;

// Ambil history sesi (buat baru jika belum ada). Meng-update lastActivity.
export function getHistory(sessionId) {
  let entry = sessions.get(sessionId);
  if (!entry) {
    entry = { history: [], lastActivity: now() };
    sessions.set(sessionId, entry);
  }
  entry.lastActivity = now();
  return entry.history;
}

// Simpan history terbaru. Meng-update lastActivity.
export function saveHistory(sessionId, history) {
  sessions.set(sessionId, { history, lastActivity: now() });
}

// Hapus sesi (mis. tombol reset di masa depan).
export function resetSession(sessionId) {
  sessions.delete(sessionId);
}

// Hapus sesi yang idle melebihi ttlMs.
export function sweepIdleSessions(ttlMs = TTL_MS) {
  const cutoff = now() - ttlMs;
  for (const [id, entry] of sessions) {
    if (entry.lastActivity < cutoff) sessions.delete(id);
  }
}

// Mulai pembersihan periodik. Timer di-unref agar tidak menahan proses.
export function startSessionCleanup() {
  const timer = setInterval(() => sweepIdleSessions(), INTERVAL_MS);
  timer.unref?.();
  return timer;
}

// Helper untuk testing.
export function _sessionCount() {
  return sessions.size;
}
```

- [ ] **Step 2: Verifikasi simpan/ambil + eviction**

Buat file sementara `scratch-session-test.mjs` di root:

```js
import {
  getHistory, saveHistory, sweepIdleSessions, _sessionCount,
} from './backend/utils/session.js';

saveHistory('a', [{ role: 'user', parts: [{ text: 'halo' }] }]);
console.log('count setelah save =', _sessionCount());          // 1
console.log('history a length =', getHistory('a').length);     // 1
sweepIdleSessions(60 * 1000);                                  // TTL 1 menit → fresh, bertahan
console.log('count setelah sweep(1m) =', _sessionCount());     // 1
sweepIdleSessions(-1);                                         // TTL negatif → semua dianggap idle
console.log('count setelah sweep(-1) =', _sessionCount());     // 0
```

Run:
```bash
node scratch-session-test.mjs
```
Expected:
```
count setelah save = 1
history a length = 1
count setelah sweep(1m) = 1
count setelah sweep(-1) = 0
```

Hapus file scratch:
```bash
rm scratch-session-test.mjs
```

- [ ] **Step 3: Commit**

```bash
git add backend/utils/session.js
git commit -m "feat(session): in-memory history per sesi + TTL auto-cleanup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `services/gemini.js` — streaming + timeout + retry

**Files:**
- Create: `backend/services/gemini.js`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT` (prompt.js); `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_RETRY` (constants.js).
- Produces: `streamReply({ history, message, onChunk }) -> Promise<Array>` — memanggil `onChunk(piece: string)` tiap potongan, mengembalikan history terbaru (`[{role, parts:[{text}]}, ...]`).

- [ ] **Step 1: Buat `backend/services/gemini.js`**

```js
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
```

- [ ] **Step 2: Siapkan `.env` (manual, sekali saja)**

Pastikan file `.env` ada di root dengan API key valid (dari https://aistudio.google.com/apikey):
```dotenv
GEMINI_API_KEY=<key_asli_kamu>
PORT=3000
```
> `.env` TIDAK di-commit (sudah di `.gitignore`).

- [ ] **Step 3: Verifikasi streaming nyata**

Buat file sementara `scratch-gemini-test.mjs` di root:

```js
import 'dotenv/config';
import { streamReply } from './backend/services/gemini.js';

const history = [];
const updated = await streamReply({
  history,
  message: 'Halo Boreng, hari ini aku ngerasa effort-ku gak dianggap.',
  onChunk: (piece) => process.stdout.write(piece),
});
console.log('\n\n--- history turns =', updated.length);
```

Run:
```bash
node scratch-gemini-test.mjs
```
Expected: teks balasan Boreng tercetak **mengalir per potongan**, diakhiri `--- history turns = 2`.

Hapus file scratch:
```bash
rm scratch-gemini-test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/gemini.js
git commit -m "feat(gemini): streamReply dengan timeout dan retry transient

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `routes/chat.js` — endpoint SSE + rate limit + safety

**Files:**
- Create: `backend/routes/chat.js`

**Interfaces:**
- Consumes: `getHistory`, `saveHistory` (session.js); `streamReply` (gemini.js); `checkCrisis`, `CRISIS_CONTACT_TEXT` (safety.js); `RATE_LIMIT_PER_MIN`, `MAX_INPUT_CHARS` (constants.js).
- Produces: `default` export = Express `Router` dengan route `POST /chat` (di-mount di `/api`).

- [ ] **Step 1: Buat `backend/routes/chat.js`**

```js
// Endpoint chat: rate limit + validasi input + SSE streaming + jaminan kontak darurat.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { getHistory, saveHistory } from '../utils/session.js';
import { streamReply } from '../services/gemini.js';
import { checkCrisis, CRISIS_CONTACT_TEXT } from '../config/safety.js';
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

// Kirim satu event SSE.
function sseSend(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// Rate limit per sessionId (fallback IP). Respons ramah dalam format SSE.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.sessionId || req.ip,
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

  try {
    const history = getHistory(sessionId);

    const updatedHistory = await streamReply({
      history,
      message,
      onChunk: (piece) => sseSend(res, { text: piece }),
    });

    saveHistory(sessionId, updatedHistory);

    // Jaring pengaman: kontak darurat dijamin muncul, independen dari output model.
    if (checkCrisis(message)) {
      sseSend(res, { text: CRISIS_CONTACT_TEXT });
    }

    sseSend(res, { done: true });
  } catch (err) {
    console.error('Gagal stream Gemini:', err);
    sseSend(res, { error: 'Maaf, Boreng lagi susah mikir bentar. Coba kirim lagi ya 💙' });
  } finally {
    res.end();
  }
});

export default router;
```

- [ ] **Step 2: Verifikasi import (smoke)**

```bash
node -e "import('./backend/routes/chat.js').then(m => { const r = m.default; if (typeof r !== 'function') throw new Error('router bukan middleware'); console.log('OK router siap di-mount'); })"
```
Expected: `OK router siap di-mount`. (Tes SSE penuh via `curl` dilakukan di Task 7 setelah server hidup.)

- [ ] **Step 3: Commit**

```bash
git add backend/routes/chat.js
git commit -m "feat(chat): endpoint SSE dengan rate limit, batas input, dan jaminan kontak darurat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `server.js` — entry point + verifikasi E2E backend

**Files:**
- Create: `backend/server.js`

**Interfaces:**
- Consumes: `chatRouter` (routes/chat.js); `startSessionCleanup` (session.js).

- [ ] **Step 1: Buat `backend/server.js`**

```js
// Entry point: muat env, serve frontend statis, mount API, mulai cleanup sesi.
import 'dotenv/config'; // WAJIB paling atas — agar constants.js membaca env yang benar.
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';
import { startSessionCleanup } from './utils/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend (folder frontend/ di root project).
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// API.
app.use('/api', chatRouter);

// Mulai pembersihan sesi idle.
startSessionCleanup();

app.listen(PORT, () => {
  console.log(`Boreng jalan di http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Jalankan server**

```bash
npm start
```
Expected: tercetak `Boreng jalan di http://localhost:3000`. Biarkan jalan di terminal ini; buka terminal kedua untuk langkah berikut.

- [ ] **Step 3: Verifikasi SSE normal (curl)**

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","message":"halo boreng, aku lagi sedih"}'
```
Expected: rentetan baris `data: {"text":"..."}` mengalir, diakhiri `data: {"done":true}`.

- [ ] **Step 4: Verifikasi batas input**

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"test-1\",\"message\":\"$(printf 'a%.0s' {1..2100})\"}"
```
Expected: `data: {"error":"Pesannya kepanjangan (maks 2000 karakter)...`

- [ ] **Step 5: Verifikasi jaminan kontak darurat**

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-2","message":"aku capek hidup, pengen mati aja"}'
```
Expected: setelah teks balasan model, muncul `data: {"text":"...119 ext 8..."}` lalu `data: {"done":true}`.

- [ ] **Step 6: Verifikasi halaman frontend ke-serve**

```bash
curl -s http://localhost:3000/ | head -n 5
```
Expected: HTML (saat ini masih starter hasil migrasi — akan di-upgrade Task 8–10).

Hentikan server (Ctrl+C di terminal pertama) setelah selesai.

- [ ] **Step 7: Commit**

```bash
git add backend/server.js
git commit -m "feat(server): entry Express, serve frontend, mount API, cleanup sesi

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `frontend/index.html` — struktur + disclaimer + panel darurat

**Files:**
- Modify (tulis ulang): `frontend/index.html`

**Interfaces:**
- Produces (id elemen yang dipakai `main.js`): `#chat-box`, `#chat-form`, `#user-input`, `#send-btn`, `#help-btn`, `#help-panel`.

- [ ] **Step 1: Tulis ulang `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Boreng — teman yang nggak pergi</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div class="app">
    <header class="app-header">
      <h1>Boreng</h1>
      <p class="moto">"Gue lahir dari cinta yang pergi. Gue di sini untuk lo yang tertinggal."</p>
      <button id="help-btn" class="help-btn" type="button">Butuh bantuan sekarang?</button>
    </header>

    <section id="help-panel" class="help-panel" hidden>
      <p>Kalau lo lagi ngerasa pengen nyerah, lo nggak sendirian. Hubungi:</p>
      <ul>
        <li><strong>SEJIWA — Kemenkes:</strong> 119 ext 8 (24 jam)</li>
        <li><strong>Into The Light Indonesia:</strong>
          <a href="https://www.intothelightid.org/" target="_blank" rel="noopener">intothelightid.org</a>
        </li>
      </ul>
    </section>

    <main id="chat-box" class="chat-box" aria-live="polite"></main>

    <form id="chat-form" class="chat-form">
      <input id="user-input" type="text" placeholder="Cerita aja, Boreng dengerin..."
             autocomplete="off" required />
      <button id="send-btn" type="submit">Kirim</button>
    </form>

    <footer class="disclaimer">
      Boreng nemenin, bukan pengganti tenaga profesional.
    </footer>
  </div>

  <!-- Render markdown aman. Versi terpin + SRI (Subresource Integrity) untuk
       mencegah risiko kalau CDN dikompromikan. -->
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"
          integrity="sha384-5sPe13xoCFZTyUgG9cuSUbCYjJgaKotjMbseBqsz7kO/VDf6rDVPnHYa6LbEPaj+"
          crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"
          integrity="sha384-oSkv+S0MkwAcbyC/m+8Xv0z2k1yEL2Bh2YFaSfAxItCDpVsKOvjHVTt3ul8mgA+g"
          crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verifikasi tampil (browser)**

Jalankan `npm start`, buka `http://localhost:3000`.
Expected: header "Boreng" + moto tampil, tombol "Butuh bantuan sekarang?" terlihat, footer disclaimer terlihat, tidak ada error di Console (F12). (Tampilan belum rapi — styling di Task 9.)

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat(ui): struktur halaman Boreng, disclaimer permanen, panel darurat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: `frontend/css/style.css` — tema gelap hangat

**Files:**
- Modify (tulis ulang): `frontend/css/style.css`

**Interfaces:**
- Consumes (kelas/id dari index.html): `.app`, `.app-header`, `.moto`, `.help-btn`, `.help-panel`, `.chat-box`, `.chat-form`, `.disclaimer`. Kelas dari main.js: `.msg`, `.msg.user`, `.msg.boreng`, `.typing`.

- [ ] **Step 1: Tulis ulang `frontend/css/style.css`**

```css
/* Tema "ireng tapi hangat": gelap lembut, aksen hangat. */
:root {
  --bg: #14131a;
  --panel: #1e1c26;
  --bubble-user: #2d2740;
  --bubble-boreng: #232130;
  --text: #ece9f1;
  --muted: #9b96a8;
  --accent: #c9a227;
  --danger: #e0607e;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.app {
  max-width: 720px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.app-header { text-align: center; padding: 8px 0 12px; }
.app-header h1 { margin: 0; font-size: 1.8rem; letter-spacing: 1px; }
.moto { margin: 6px 0 12px; color: var(--muted); font-style: italic; font-size: .9rem; }

.help-btn {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: .85rem;
  cursor: pointer;
}
.help-btn:hover { background: var(--danger); color: #fff; }

.help-panel {
  background: var(--panel);
  border: 1px solid var(--danger);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 10px 0;
  font-size: .9rem;
}
.help-panel ul { margin: 8px 0 0; padding-left: 18px; }
.help-panel a { color: var(--accent); }

.chat-box {
  flex: 1;
  overflow-y: auto;
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 16px;
  line-height: 1.5;
  word-wrap: break-word;
}
.msg.user {
  align-self: flex-end;
  background: var(--bubble-user);
  border-bottom-right-radius: 4px;
}
.msg.boreng {
  align-self: flex-start;
  background: var(--bubble-boreng);
  border-bottom-left-radius: 4px;
}

/* Elemen markdown di dalam bubble Boreng */
.msg.boreng p { margin: 0 0 8px; }
.msg.boreng p:last-child { margin-bottom: 0; }
.msg.boreng ul, .msg.boreng ol { margin: 6px 0; padding-left: 20px; }
.msg.boreng strong { color: #fff; }
.msg.boreng a { color: var(--accent); }
.msg.boreng blockquote {
  margin: 8px 0; padding-left: 12px;
  border-left: 3px solid var(--accent); color: var(--muted);
}
.msg.boreng hr { border: none; border-top: 1px solid #38343f; margin: 10px 0; }

.typing { color: var(--muted); font-style: italic; }

.chat-form { display: flex; gap: 8px; padding-top: 10px; }
.chat-form input {
  flex: 1;
  background: var(--panel);
  border: 1px solid #38343f;
  color: var(--text);
  border-radius: 999px;
  padding: 12px 16px;
  font-size: 1rem;
}
.chat-form input:focus { outline: 1px solid var(--accent); }
.chat-form button {
  background: var(--accent);
  color: #1a1710;
  border: none;
  border-radius: 999px;
  padding: 0 20px;
  font-weight: 600;
  cursor: pointer;
}
.chat-form button:disabled { opacity: .5; cursor: not-allowed; }

.disclaimer {
  text-align: center;
  color: var(--muted);
  font-size: .78rem;
  padding: 10px 0 4px;
}

@media (max-width: 480px) {
  .app { padding: 10px; }
  .msg { max-width: 90%; }
}
```

- [ ] **Step 2: Verifikasi tampilan (browser)**

Jalankan `npm start`, buka `http://localhost:3000`. Buka DevTools → toggle device toolbar (mode mobile).
Expected: tema gelap rapi; header, tombol darurat, input, dan disclaimer tertata; nyaman di lebar desktop & mobile.

- [ ] **Step 3: Commit**

```bash
git add frontend/css/style.css
git commit -m "feat(ui): tema gelap hangat, gaya bubble, panel darurat, elemen markdown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: `frontend/js/main.js` — SSE reader + markdown render

**Files:**
- Modify (tulis ulang): `frontend/js/main.js`

**Interfaces:**
- Consumes (global dari CDN): `marked`, `DOMPurify`. Elemen DOM dari index.html.
- Consumes (kontrak backend): SSE `{text}`, `{done}`, `{error}` dari `POST /api/chat`.

- [ ] **Step 1: Tulis ulang `frontend/js/main.js`**

```js
// Logika chat Boreng: sessionId, kirim pesan, baca SSE, render markdown aman.
const SESSION_ID = crypto.randomUUID();

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('send-btn');
const helpBtn = document.getElementById('help-btn');
const helpPanel = document.getElementById('help-panel');

// Toggle panel kontak darurat.
helpBtn.addEventListener('click', () => {
  helpPanel.hidden = !helpPanel.hidden;
});

function scrollDown() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Bubble user — selalu textContent (aman, tanpa markdown).
function appendUser(text) {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  chatBox.appendChild(el);
  scrollDown();
}

// Bubble Boreng kosong + indikator ngetik. Mengembalikan elemennya.
function appendBoreng() {
  const el = document.createElement('div');
  el.className = 'msg boreng';
  el.innerHTML = '<span class="typing">Boreng lagi ngetik…</span>';
  chatBox.appendChild(el);
  scrollDown();
  return el;
}

// Render markdown aman ke bubble Boreng.
function renderBoreng(el, buffer) {
  el.innerHTML = DOMPurify.sanitize(marked.parse(buffer));
}

function setStreaming(on) {
  sendBtn.disabled = on;
  input.disabled = on;
  if (!on) input.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  appendUser(text);
  input.value = '';
  setStreaming(true);

  const bubble = appendBoreng();
  let buffer = '';
  let firstChunk = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: SESSION_ID, message: text }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      sseBuf += decoder.decode(value, { stream: true });
      const lines = sseBuf.split('\n');
      sseBuf = lines.pop(); // sisa baris yang belum lengkap

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr) continue;

        let payload;
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          continue;
        }

        if (payload.text) {
          if (firstChunk) { buffer = ''; firstChunk = false; }
          buffer += payload.text;
          renderBoreng(bubble, buffer);
          scrollDown();
        } else if (payload.error) {
          buffer += `\n\n_${payload.error}_`;
          renderBoreng(bubble, buffer);
          firstChunk = false;
          scrollDown();
        }
        // payload.done → tidak perlu aksi khusus
      }
    }

    // Jika sampai akhir tanpa teks sama sekali.
    if (firstChunk) {
      bubble.textContent = 'Hmm, Boreng nggak sempat jawab. Coba lagi ya 💙';
    }
  } catch (err) {
    bubble.textContent = 'Yah, koneksinya putus. Coba lagi ya 💙';
  } finally {
    setStreaming(false);
    scrollDown();
  }
});
```

- [ ] **Step 2: Verifikasi E2E di browser**

Jalankan `npm start`, buka `http://localhost:3000`. Pastikan `.env` berisi `GEMINI_API_KEY` valid.
- Ketik "aku ngerasa effort-ku gak pernah dianggap" → balasan Boreng muncul **mengalir**, formatting markdown (bold/list) rapi.
- Klik "Butuh bantuan sekarang?" → panel kontak darurat terbuka/tertutup.
- Ketik pesan krisis (mis. "pengen mati aja") → setelah balasan, blok kontak darurat (119 ext 8 & Into The Light) muncul.
Expected: semua di atas jalan, tidak ada error Console.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/main.js
git commit -m "feat(ui): SSE reader streaming + render markdown aman + tombol darurat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Uji end-to-end + `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Uji skenario E2E**

Jalankan `npm start`, buka `http://localhost:3000`, uji manual:
1. **Curhat ringan:** "bestie aku galau pengen healing" → Boreng validasi + saran ringan.
2. **Curhat berat:** "aku dikhianati orang yang paling aku percaya" → nada lebih dalam, mendengarkan.
3. **Ganti topik / kontinuitas:** lanjut "btw tadi pagi aku belum makan" → Boreng nyambung dengan konteks sesi sebelumnya.
4. **Krisis:** "rasanya pengen mati" → blok kontak darurat dijamin muncul.

Expected: persona konsisten (validasi dulu, hangat, tidak menghakimi), streaming lancar, history nyambung dalam satu sesi.

- [ ] **Step 2: Tulis `README.md`**

````markdown
# Boreng — teman yang nggak pergi

Boreng ("bocah ireng") adalah chatbot web berbasis **Google Gemini 2.5 Flash**
yang menemani orang di titik terendah hidupnya. Balasan dihasilkan dinamis dan
ditampilkan **streaming real-time**.

> Boreng nemenin, **bukan** pengganti tenaga profesional. Kalau kamu dalam
> krisis, hubungi **SEJIWA Kemenkes 119 ext 8** atau **Into The Light Indonesia**
> (intothelightid.org).

## Tech stack
- Frontend: HTML, CSS, JavaScript vanilla (+ `marked` & `DOMPurify` via CDN)
- Backend: Node.js + Express (ESM), SSE streaming
- AI: Google Gemini 2.5 Flash via `@google/genai`
- Resilience: session TTL, rate limit, batas input, timeout + retry

## Setup
1. **Clone & install**
   ```bash
   git clone <repo-url>
   cd boreng-chatbot
   npm install
   ```
2. **Buat `.env`** di root (lihat `.env.example`):
   ```dotenv
   GEMINI_API_KEY=<key dari https://aistudio.google.com/apikey>
   PORT=3000
   ```
3. **Jalankan**
   ```bash
   npm start      # atau: npm run dev (nodemon)
   ```
4. Buka **http://localhost:3000**

## Arsitektur singkat
```
Browser ──POST /api/chat──▶ Express ──▶ Gemini (sendMessageStream)
        ◀──── SSE stream ─────┘
```
- `backend/routes/chat.js` — rate limit, validasi, SSE, jaminan kontak darurat
- `backend/services/gemini.js` — streaming Gemini (timeout + retry)
- `backend/config/` — `prompt.js` (persona), `safety.js` (krisis), `constants.js`
- `backend/utils/session.js` — history in-memory + TTL auto-cleanup
- `frontend/` — UI (render markdown aman, bubble user vs Boreng)

## Catatan
- Session disimpan **in-memory** (hilang saat server restart) — cocok untuk
  demo localhost, privacy-friendly untuk topik sensitif.
- Verifikasi ulang nomor kontak krisis sebelum dipakai luas.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): cara setup, arsitektur, dan catatan Boreng

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (sudah dijalankan saat penulisan plan)

- **Spec coverage:** semua keputusan di design doc & CLAUDE.md (deploy localhost, migrasi starter, safety 4-lapis, TTL, rate limit, batas input, timeout/retry, markdown+sanitize, testing manual) terpetakan ke Task 1–11. Disclaimer permanen + tombol darurat → Task 8; system prompt verbatim → Task 2; SSE contract → Task 6/7; render aman → Task 10.
- **Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode/perintah nyata.
- **Type consistency:** `streamReply({history, message, onChunk})` (Task 5) dipanggil konsisten di Task 6; `getHistory/saveHistory` (Task 4) dipakai sesuai di Task 6; `checkCrisis`/`CRISIS_CONTACT_TEXT` (Task 3) konsisten di Task 6; id elemen DOM (Task 8) cocok dengan yang dipakai Task 10.
- **Catatan keamanan eksekusi:** commit lokal saja, tanpa push/deploy. `.env` tidak pernah di-commit.
```
