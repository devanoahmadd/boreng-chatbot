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
