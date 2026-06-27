# CLAUDE.md — Boreng

> File ini adalah **spesifikasi & pondasi project**. Claude Code membaca file ini
> secara otomatis sebagai konteks. Ikuti dokumen ini sebagai sumber kebenaran:
> arsitektur, urutan build, konvensi, dan SDK yang dipakai.

---

## 1. Tentang project

**Boreng** adalah chatbot web berbasis Google Gemini yang menemani orang yang
sedang berada di titik paling bawah dalam hidupnya — entah karena cinta yang tak
dibalas, effort yang tak dianggap, dikhianati, ditinggalkan, masalah ekonomi,
pekerjaan, keluarga, kesehatan, atau merasa tidak cukup baik.

Boreng **bukan** chatbot statis/hardcoded. Setiap balasan dihasilkan secara
dinamis oleh model **Gemini 2.5 Flash**, dan ditampilkan **real-time (streaming)**
ke browser.

Boreng **bukan** pengganti tenaga profesional. Boreng adalah teman yang
mendengarkan, memvalidasi, dan menemani.

---

## 2. Filosofi & persona Boreng (jiwa project ini)

**Boreng = "bocah ireng"** — nama sebuah boneka kecil dari seseorang yang pernah
sangat dicintai, lalu memilih pergi. Filosofinya:

- **Ireng bukan kekurangan, tapi kedalaman.** Tanah paling gelap paling subur;
  langit paling hitam menyimpan bintang paling terang.
- **Bocah = kejujuran yang hilang.** Anak kecil tidak pura-pura baik-baik saja
  saat terluka. Boreng membawa kembali kejujuran itu.
- **Boneka yang tidak pergi.** Lahir dari sesuatu yang pergi, maka ia memilih
  untuk *tetap tinggal* dan menemani.
- **Moto:** *"Gue lahir dari cinta yang pergi. Gue di sini untuk lo yang tertinggal."*

Persona ini harus tercermin di seluruh UI (copywriting, tone) dan di system prompt.

---

## 3. Tech stack (wajib)

| Layer | Teknologi |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla, tanpa framework) |
| Backend | Node.js + Express |
| AI Model | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| SDK | `@google/genai` (lihat Bagian 7 — **bukan** `@google/generative-ai`) |
| Runtime | Node.js 20+ , project pakai ESM (`"type": "module"`) |
| Rate limit | `express-rate-limit` (npm) — proteksi `/api/chat` (lihat Bagian 4 & 9) |
| Render markdown | `marked` + `dompurify` (via CDN `<script>`, bukan npm) — balasan rapi & anti-XSS |

---

## 4. Keputusan teknis (sudah final — jangan diubah tanpa diminta)

| Aspek | Keputusan | Alasan |
|---|---|---|
| Mode respons | **SSE streaming** (Server-Sent Events) | UX terasa hidup & manusiawi, lebih impresif untuk final project |
| Memory | **In-memory `Map` per session** (tanpa database) | Privacy-friendly untuk topik sensitif, cukup untuk scope ini |
| Session ID | `crypto.randomUUID()` per browser, dikirim via header/body | Tanpa login, tanpa cookie wajib |
| Fitur AI | Rekomendasi lagu/aktivitas/kata-kata via **system prompt** | Tidak butuh API eksternal terpisah |
| Gaya bahasa | Campuran: Gen-Z santai + hangat dewasa + serius saat krisis | Dikontrol penuh dari system prompt |
| Deploy target | **Localhost / demo bootcamp** (single instance) | In-memory `Map` aman 100%, tanpa store eksternal |
| Render balasan | **Markdown + sanitasi** (`marked` + `DOMPurify`) di frontend | Formatting rapi & anti-XSS (lihat Bagian 9) |
| Safety krisis | **System prompt + 3 lapis**: keyword safety layer (backend), disclaimer permanen (UI), akses cepat kontak darurat (UI) | Kontak darurat dijamin muncul walau model lupa (lihat Bagian 9 & 12) |
| Resilience | **Session TTL + auto-cleanup**, **retry + timeout Gemini**, **rate limit + batas input** (tanpa batas panjang history) | Tahan memory leak, error transient, & boros kuota |

> Keputusan baris 6–9 difinalkan di sesi brainstorming 2026-06-26 — detail di
> `docs/superpowers/specs/2026-06-26-boreng-pondasi-design.md`.

---

## 5. Arsitektur

```
Browser (frontend)
   │  POST /api/chat   { sessionId, message }
   │  ◄── SSE stream   data: {"text":"..."}\n\n
   ▼
Node.js / Express
   ├── routes/chat.js     → rate limit + validasi input, buka SSE, relay teks, jamin blok darurat
   ├── services/gemini.js → panggil Gemini (timeout + retry), stream balik per-chunk
   ├── config/prompt.js   → system prompt (jiwa Boreng)
   ├── config/safety.js   → keyword krisis + checkCrisis() + teks kontak darurat
   ├── config/constants.js→ TTL, rate limit, batas input, timeout, retry (default + env override)
   └── utils/session.js   → Map<sessionId, { history, lastActivity }> + TTL sweep
   │
   ▼
Gemini 2.5 Flash  (ai.chats.create → sendMessageStream)
```

Alur satu pesan:
1. Frontend kirim `POST /api/chat` berisi `sessionId` + `message`.
2. Route cek **rate limit** + **batas panjang input**; jika lewat → SSE `error` ramah.
3. Route ambil `history` lama dari `session.js` (sekaligus touch `lastActivity`).
4. `gemini.js` buat chat (`ai.chats.create`) dengan `systemInstruction` + `history`,
   panggil `sendMessageStream` (dibungkus timeout + retry).
5. Tiap chunk teks ditulis ke response sebagai event SSE → frontend render real-time.
6. Jika `checkCrisis(message)` true → setelah stream selesai, **jamin** kirim satu
   blok SSE berisi kontak darurat (independen dari output model).
7. Setelah selesai, history (user + model) disimpan kembali ke `session.js`.

---

## 6. Struktur folder

```
boreng-chatbot/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── backend/
│   ├── server.js                # entry point Express + serve frontend
│   ├── routes/
│   │   └── chat.js              # POST /api/chat + SSE
│   ├── services/
│   │   └── gemini.js            # integrasi Gemini streaming
│   ├── config/
│   │   ├── prompt.js            # system prompt Boreng
│   │   ├── safety.js            # keyword krisis + checkCrisis() + teks kontak darurat
│   │   └── constants.js         # TTL, rate limit, batas input, timeout, retry
│   └── utils/
│       └── session.js           # in-memory history + TTL auto-cleanup
├── .env                         # GEMINI_API_KEY=... (JANGAN di-commit)
├── .env.example                 # template tanpa nilai rahasia
├── .gitignore
├── package.json
└── README.md
```

---

## 7. SDK & API notes — PENTING, BACA DULU

**Gunakan paket `@google/genai`.** Paket lama `@google/generative-ai`
(`GoogleGenerativeAI`, `getGenerativeModel`, `startChat`) sudah **deprecated**
dan EOL 30 November 2025. Jangan dipakai. Jangan generate kode dengan SDK lama.

### Inisialisasi
```js
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Chat dengan system instruction + history + streaming (pola inti project)
```js
const chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: SYSTEM_PROMPT,  // dari config/prompt.js
    temperature: 0.9,
  },
  history,  // array: [{ role:'user'|'model', parts:[{ text:'...' }] }, ...]
});

const stream = await chat.sendMessageStream({ message: userText });
for await (const chunk of stream) {
  const piece = chunk.text;   // potongan teks
  // tulis piece ke SSE di sini
}

// setelah loop selesai, ambil history terbaru untuk disimpan kembali:
const updatedHistory = chat.getHistory();
```

### Format history yang disimpan di session
```js
{ role: 'user',  parts: [{ text: 'pesan user' }] }
{ role: 'model', parts: [{ text: 'balasan boreng' }] }
```

Dokumentasi resmi: https://googleapis.github.io/js-genai/

---

## 8. Format SSE (kontrak frontend ↔ backend)

Backend response header:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Tiap potongan teks dikirim sebagai:
```
data: {"text":"potongan teks"}\n\n
```

Saat selesai, kirim sinyal akhir:
```
data: {"done":true}\n\n
```

Jika error:
```
data: {"error":"pesan error"}\n\n
```

Frontend membaca pakai `fetch` + `ReadableStream` reader (bukan `EventSource`,
karena kita memakai `POST`). Buffer per baris, parse `data:` JSON, append `text`
ke bubble Boreng yang sedang aktif.

---

## 9. Konvensi kode

- ESM di mana-mana (`import`/`export`), karena `package.json` punya `"type":"module"`.
- Untuk `__dirname` di ESM:
  ```js
  import { fileURLToPath } from 'url';
  import path from 'path';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  ```
- Muat env paling atas di `server.js`: `import 'dotenv/config';`
- Jangan pernah menaruh API key di frontend atau commit `.env`.
- Komentar singkat dalam Bahasa Indonesia di file penting.
- Tangani error Gemini dengan `try/catch`; kirim event SSE `error`, jangan crash server.

### Resilience (wajib)
- **Session TTL:** entry `Map` = `{ history, lastActivity }`. `getHistory`/`saveHistory`
  meng-touch `lastActivity`. Sweep periodik (`setInterval`) menghapus sesi idle
  melebihi `SESSION_TTL_MIN`. Semua angka dari `config/constants.js`.
- **Rate limit:** pakai `express-rate-limit` di `/api/chat`, key = `sessionId`
  (fallback IP), maks `RATE_LIMIT_PER_MIN`. Lebih → SSE `error` ramah.
- **Batas input:** tolak pesan > `MAX_INPUT_CHARS` sebelum memanggil Gemini.
- **Timeout + retry Gemini:** bungkus panggilan dengan timeout `GEMINI_TIMEOUT_MS`
  + retry `GEMINI_MAX_RETRY` untuk error transient (5xx/network).
- **Tanpa** batas panjang history (sengaja — rate limit + batas input yang menahan kuota).

### Safety krisis (wajib)
- System prompt (Bagian 10) tetap garda utama.
- `config/safety.js` punya `checkCrisis(message)` (keyword ID + EN). Ini **jaring
  pengaman**, bukan deteksi akurat — pasti ada false positive/negative.
- Jika true → backend **menjamin** mengirim blok SSE kontak darurat (SEJIWA 119
  ext 8 & Into The Light) setelah stream, independen dari output model.
- UI: disclaimer permanen + tombol akses cepat kontak darurat selalu terlihat.

### Render balasan (frontend)
- Bubble user → selalu `textContent` (aman, tanpa markdown).
- Bubble Boreng → `bubble.innerHTML = DOMPurify.sanitize(marked.parse(buffer))`
  per chunk. Jangan pernah `innerHTML` teks model tanpa sanitasi (XSS).

---

## 10. System prompt Boreng (salin VERBATIM ke `config/prompt.js`)

```
Kamu adalah Boreng — nama dari "bocah ireng", nama boneka kecil yang pernah
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
Boreng di sini. Dan Boreng tidak akan ke mana-mana.
```

> Catatan: nomor/kontak krisis di atas sebaiknya kamu verifikasi ulang saat
> deploy. Untuk Indonesia, rujukan umum adalah layanan SEJIWA Kemenkes (119 ext 8)
> dan Into The Light Indonesia.

---

## 11. Keamanan & env

`.env` (jangan di-commit):
```
GEMINI_API_KEY=masukkan_key_dari_google_ai_studio
PORT=3000
# Opsional — override default di config/constants.js
SESSION_TTL_MIN=30
CLEANUP_INTERVAL_MIN=10
RATE_LIMIT_PER_MIN=15
MAX_INPUT_CHARS=2000
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRY=1
```

`.env.example` (boleh di-commit):
```
GEMINI_API_KEY=
PORT=3000
SESSION_TTL_MIN=30
CLEANUP_INTERVAL_MIN=10
RATE_LIMIT_PER_MIN=15
MAX_INPUT_CHARS=2000
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRY=1
```

`config/constants.js` memuat default angka di atas; `.env` hanya untuk override
(angka di atas sudah jadi default yang aman tanpa `.env`).

`.gitignore` minimal: `node_modules/`, `.env`, logs.

API key didapat gratis dari Google AI Studio (https://aistudio.google.com/apikey).

---

## 12. BUILD ORDER (kerjakan satu per satu, jangan lompat)

Kerjakan tiap step sampai selesai & lolos kriteria, baru lanjut ke step berikutnya.
Jangan menulis kode untuk step yang belum diminta.

**Step 1 — Scaffold project**
- Buat semua folder sesuai Bagian 6.
- Buat `package.json` (`"type":"module"`, script `start` & `dev`), lalu install:
  `@google/genai`, `express`, `cors`, `dotenv`, `express-rate-limit`
  (+ `nodemon` sebagai devDependency).
- **Migrasi starter** `Sesi 3 - Starter Code/starter/` → `frontend/` sebagai titik
  awal (`index.html`, `css/style.css`, `js/main.js`) — akan di-upgrade di Step 7–9.
- Buat `config/constants.js` (default dari Bagian 11).
- Buat `.gitignore`, `.env.example`. Ingatkan user membuat `.env` manual.
- Kriteria: `npm install` sukses, struktur folder lengkap.

**Step 2 — `config/prompt.js`**
- Export `SYSTEM_PROMPT` berisi teks Bagian 10 secara verbatim.
- Kriteria: bisa di-import tanpa error.

**Step 3 — `utils/session.js`**
- `Map<sessionId, { history, lastActivity }>`. Fungsi: `getHistory(id)`,
  `saveHistory(id, history)`, `resetSession(id)`. Buat session baru otomatis jika
  belum ada. `getHistory`/`saveHistory` meng-update `lastActivity`.
- **TTL auto-cleanup:** `setInterval` (tiap `CLEANUP_INTERVAL_MIN`) hapus sesi
  idle > `SESSION_TTL_MIN`.
- Kriteria: unit kecil di node REPL menyimpan & mengambil history; sesi idle
  terhapus setelah TTL (boleh tes dengan TTL kecil).

**Step 4 — `services/gemini.js`**
- Inisialisasi `GoogleGenAI` dari Bagian 7.
- Fungsi `streamReply({ history, message, onChunk })` yang memakai
  `ai.chats.create` + `sendMessageStream`, memanggil `onChunk(piece)` tiap chunk,
  dan mengembalikan history terbaru (`chat.getHistory()`).
- Bungkus dengan `try/catch` + **timeout** (`GEMINI_TIMEOUT_MS`) + **retry**
  (`GEMINI_MAX_RETRY`) untuk error transient (5xx/network).
- Kriteria: dipanggil dari script kecil, mencetak balasan Gemini per potongan;
  error transient di-retry, gagal final melempar rapi (tidak crash).

**Step 4.5 — `config/safety.js`** *(baru)*
- Export daftar frasa krisis (ID + EN) + `checkCrisis(message) -> boolean` +
  teks blok kontak darurat (SEJIWA 119 ext 8 & Into The Light, nada tenang).
- Kriteria: `checkCrisis` mengenali contoh kalimat krisis & mengembalikan blok teks.

**Step 5 — `routes/chat.js`**
- Pasang **rate limit** (`express-rate-limit`, key `sessionId` fallback IP).
- `POST /api/chat`: validasi body + **batas input** (`MAX_INPUT_CHARS`), ambil
  history, set header SSE, panggil `services/gemini.js`, tulis tiap chunk sebagai
  `data: {...}\n\n`. Jika `checkCrisis(message)` true → setelah stream, **jamin**
  kirim blok kontak darurat sebagai SSE. Kirim `done`, simpan history.
- Tangani semua error (rate limit, input, Gemini) sebagai event SSE `error` ramah.
- Kriteria: `curl -N` mengembalikan stream SSE; input kepanjangan & banjir request
  ditolak rapi; pesan krisis memunculkan blok darurat.

**Step 6 — `server.js`**
- `import 'dotenv/config'`, Express app, `express.json()`, `cors()`.
- Serve folder `frontend/` sebagai static, mount router `/api`.
- Listen di `PORT`.
- Kriteria: `npm start` jalan, buka `http://localhost:3000` tampil halaman frontend.

**Step 7 — `frontend/index.html`** *(upgrade dari starter hasil migrasi)*
- Struktur: header (nama + moto Boreng), area chat (list bubble), input + tombol kirim.
- **Disclaimer permanen** (footer): "Boreng nemenin, bukan pengganti tenaga profesional."
- **Tombol akses cepat kontak darurat** ("Butuh bantuan sekarang?") + panel kontaknya.
- Muat CDN `marked` & `DOMPurify`. Link ke `css/style.css` dan `js/main.js`.
- Kriteria: halaman tampil rapi tanpa JS error; disclaimer & tombol darurat terlihat.

**Step 8 — `frontend/css/style.css`** *(upgrade dari starter hasil migrasi)*
- Tema gelap lembut yang menenangkan, sesuai persona "ireng tapi hangat".
- Bubble user vs Boreng dibedakan. Indikator "Boreng lagi ngetik…".
- Style disclaimer, panel darurat, & elemen markdown (list, bold, blockquote, link).
- Kriteria: tampilan nyaman di desktop & mobile.

**Step 9 — `frontend/js/main.js`** *(upgrade dari starter hasil migrasi)*
- Generate/simpan `sessionId` (`crypto.randomUUID()` di memori halaman).
- Kirim pesan via `fetch POST /api/chat`, baca SSE lewat `ReadableStream` reader.
- Bubble Boreng render **markdown aman**: `DOMPurify.sanitize(marked.parse(buffer))`
  per chunk; bubble user pakai `textContent`.
- Handler tombol darurat (buka panel kontak). Auto-scroll, disable tombol saat
  streaming, render SSE `error` dengan ramah.
- Kriteria: ketik pesan → balasan Boreng muncul mengalir, formatting markdown rapi.

**Step 10 — Uji end-to-end + `README.md`**
- Tes beberapa skenario (curhat ringan, berat, ganti topik).
- Tulis `README.md`: deskripsi, cara setup (`.env`, `npm install`, `npm start`),
  penjelasan arsitektur singkat, dan catatan bahwa Boreng bukan pengganti
  bantuan profesional.
- Kriteria: orang lain bisa clone & jalankan hanya dari README.

---

## 13. Definition of done

- Pesan user → balasan Gemini muncul **streaming** real-time.
- History percakapan nyambung dalam satu sesi (Boreng ingat konteks sebelumnya).
- API key aman di backend, tidak bocor ke frontend.
- Persona Boreng konsisten: validasi dulu, hangat, tidak menghakimi, aman saat krisis.
- Project bisa dijalankan dari nol mengikuti README.
- **Sesi idle terhapus otomatis (TTL)** — memory tidak bocor.
- **Rate limit & batas input aktif** dan memberi pesan ramah saat dilanggar.
- **Error/timeout Gemini ditangani** (retry + pesan ramah) — server tidak crash.
- **Pesan krisis → kontak darurat dijamin muncul**; disclaimer & tombol darurat selalu terlihat.
- **Balasan markdown ter-render rapi & aman (anti-XSS)**, tetap streaming.
