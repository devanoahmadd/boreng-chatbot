# Design Spec — Penguatan Pondasi Boreng

> Status: **Disetujui untuk diterapkan ke CLAUDE.md**
> Tanggal: 2026-06-26
> Konteks: Final project bootcamp (Sesi 3). Dokumen ini memperkuat `CLAUDE.md`
> agar pondasi sesuai kompleksitas project tanpa mengubah keputusan inti yang
> sudah final (3-tier, SSE streaming, in-memory session, SDK `@google/genai`).

---

## 1. Keputusan yang dikunci di sesi brainstorming

| Aspek | Keputusan | Konsekuensi |
|---|---|---|
| Deploy target | **Localhost / demo bootcamp** | Single instance → in-memory `Map` aman 100%, tidak perlu store eksternal/serverless rethink |
| Starter code | **Migrasi `Sesi 3 - Starter Code/starter/` → `frontend/`**, lalu di-upgrade | Starter dummy jadi titik awal frontend, bukan dibuang/dibangun ulang dari nol |
| Safety krisis | **System prompt (fondasi) + 3 lapis tambahan**: keyword safety layer (backend), disclaimer permanen (UI), akses cepat kontak darurat (UI) | Kontak darurat dijamin muncul walau model lupa |
| Resilience | **Session TTL + auto-cleanup, retry + timeout Gemini, rate limit + batas input** (TANPA batas panjang history) | Tahan memory leak, error transient, dan boros kuota |
| Render balasan | **Markdown + sanitasi** (`marked` + `DOMPurify`) | Formatting rapi, anti-XSS |
| Testing | **Manual** (`curl -N` + browser) | Cukup untuk scope bootcamp |

Keputusan inti dari `CLAUDE.md` (SSE, `Map` per session, `@google/genai`,
persona Boreng, build order) **tidak berubah** — dokumen ini hanya menambah lapisan.

---

## 2. Dependency baru

| Paket | Lokasi muat | Alasan |
|---|---|---|
| `marked` | Frontend, via CDN `<script>` | Parse markdown balasan Gemini → HTML |
| `dompurify` | Frontend, via CDN `<script>` | Sanitasi HTML hasil parse → cegah XSS |
| `express-rate-limit` | Backend, `npm install` | Rate limit endpoint `/api/chat` |

Catatan: frontend vanilla tanpa bundler, jadi `marked` & `DOMPurify` dimuat via
CDN (bukan `npm`). Hanya `express-rate-limit` yang masuk `package.json`.

---

## 3. Session lifecycle (TTL + auto-cleanup)

### Perubahan bentuk data
Entry `Map` berubah dari `history[]` menjadi objek ber-timestamp:
```js
Map<sessionId, { history: [], lastActivity: <epoch ms> }>
```

### Aturan
- `getHistory(id)` dan `saveHistory(id, history)` meng-update `lastActivity` (touch).
- Sweep periodik (`setInterval`, default tiap 10 menit) menghapus sesi dengan
  `now - lastActivity > SESSION_TTL`.
- `resetSession(id)` tetap ada.
- Sesi baru dibuat otomatis saat `getHistory` dipanggil untuk id yang belum ada.

### Kriteria selesai
- Sesi idle terhapus otomatis setelah TTL.
- Aktivitas baru mereset timer idle.
- Memory tidak tumbuh tanpa batas selama server hidup.

---

## 4. Arsitektur safety krisis (4 lapis)

> **Prinsip penting:** keyword matching adalah **jaring pengaman**, bukan deteksi
> krisis yang akurat. Pasti ada false positive/negative. System prompt tetap
> garda utama; keyword layer hanya **menjamin** kontak darurat muncul. Jangan
> pernah memasarkan fitur ini sebagai "deteksi krisis akurat".

### Lapis 1 — System prompt (fondasi, selalu aktif)
Sudah ada di `CLAUDE.md` Bagian 10 (SITUASI DARURAT). Tidak diubah.

### Lapis 2 — Keyword safety layer (backend)
- File baru: `backend/config/safety.js`.
- Isi: daftar frasa self-harm (Bahasa Indonesia + English) + fungsi
  `checkCrisis(message) -> boolean`.
- Alur di `routes/chat.js`: cek pesan user → jika `checkCrisis` true, setelah
  stream balasan Gemini selesai, backend **menjamin** mengirim satu blok SSE
  tambahan berisi kontak darurat dengan nada tenang (tidak menghakimi, tidak
  menutup percakapan).
- Kontak: **SEJIWA Kemenkes 119 ext 8** & **Into The Light Indonesia**
  (verifikasi ulang saat deploy — sesuai catatan `CLAUDE.md`).

### Lapis 3 — Disclaimer permanen (UI)
- Footer kecil yang selalu terlihat:
  *"Boreng nemenin, bukan pengganti tenaga profesional."*

### Lapis 4 — Akses cepat kontak darurat (UI)
- Tombol "Butuh bantuan sekarang?" yang selalu terlihat → membuka panel/section
  berisi kontak darurat, bisa diakses kapan saja tanpa harus mengetik.

### Kriteria selesai
- Saat pesan mengandung sinyal krisis, kontak darurat muncul **dijamin**
  (independen dari output model).
- Disclaimer & tombol darurat selalu terlihat di UI.

---

## 5. Resilience

### Rate limit
- `express-rate-limit` pada `/api/chat`.
- Key = `sessionId` (fallback IP jika tidak ada).
- Default: **15 pesan/menit**. Kelebihan → respons SSE `error` yang ramah.

### Batas input
- Validasi panjang pesan **≤ 2000 karakter** sebelum memanggil Gemini.
- Lebih panjang → ditolak dengan pesan ramah (tanpa memanggil API).

### Retry + timeout Gemini
- `services/gemini.js` dibungkus timeout **~30 detik** + **retry 1×** untuk error
  transient (5xx / network).
- Gagal final → kirim SSE `error` bernada Boreng, server **tidak crash**.

### Catatan
- **Tanpa** batas panjang history (sesuai pilihan user). Rate limit + batas input
  yang menahan boros kuota & ledakan token.

### Kriteria selesai
- Banjir request ditolak dengan rapi.
- Input kepanjangan ditolak sebelum hit API.
- Error/timeout Gemini → pesan ramah, bukan crash.

---

## 6. Frontend rendering (markdown aman)

- Bubble **user**: selalu `textContent` (tanpa markdown, aman by default).
- Bubble **Boreng**: akumulasi teks mentah di buffer; tiap chunk SSE:
  ```js
  bubble.innerHTML = DOMPurify.sanitize(marked.parse(buffer));
  ```
- Streaming tetap terasa mengalir, formatting (bold/list) rapi, XSS tertutup.

### Kriteria selesai
- Balasan markdown tampil rapi, mengalir real-time.
- Tidak ada eksekusi HTML/script berbahaya dari output model.

---

## 7. Konstanta & env

File baru `backend/config/constants.js` memuat default (boleh override via `.env`):

| Konstanta | Default | Fungsi |
|---|---|---|
| `SESSION_TTL_MIN` | 30 | Umur idle sesi sebelum dihapus |
| `CLEANUP_INTERVAL_MIN` | 10 | Interval sweep cleanup |
| `RATE_LIMIT_PER_MIN` | 15 | Maks pesan per menit per sesi |
| `MAX_INPUT_CHARS` | 2000 | Batas panjang pesan user |
| `GEMINI_TIMEOUT_MS` | 30000 | Timeout panggilan Gemini |
| `GEMINI_MAX_RETRY` | 1 | Jumlah retry error transient |

---

## 8. Dampak ke struktur folder

File baru (di luar struktur `CLAUDE.md` Bagian 6):
```
backend/
├── config/
│   ├── prompt.js        (sudah ada di spec)
│   ├── safety.js        ← BARU: keyword krisis + checkCrisis()
│   └── constants.js     ← BARU: default config + env override
```
Frontend: tambahan elemen disclaimer + tombol/panel darurat + script CDN
`marked` & `DOMPurify` di `index.html`.

---

## 9. Dampak ke BUILD ORDER (Bagian 12 CLAUDE.md)

Penyisipan ke urutan build yang sudah ada:

- **Step 1 (Scaffold):** tambah `express-rate-limit` ke dependency; migrasi
  starter `Sesi 3` ke `frontend/`; buat `config/constants.js`.
- **Step 3 (`session.js`):** tambah TTL + `lastActivity` touch + sweep cleanup.
- **Step 4 (`gemini.js`):** tambah timeout + retry transient.
- **Step 4.5 (BARU — `config/safety.js`):** keyword krisis + `checkCrisis()` +
  teks blok kontak darurat.
- **Step 5 (`chat.js`):** tambah rate limit middleware + validasi `MAX_INPUT_CHARS`
  + panggil `checkCrisis` + jaminan append blok darurat via SSE.
- **Step 7 (`index.html`):** tambah disclaimer permanen + tombol darurat + CDN
  `marked`/`DOMPurify`.
- **Step 8 (`style.css`):** style disclaimer, panel darurat, dan elemen markdown
  (list, bold, blockquote).
- **Step 9 (`main.js`):** render Boreng via `marked` + `DOMPurify`; handler tombol
  darurat; render SSE `error` dengan ramah.

---

## 10. Definition of Done (tambahan, melengkapi Bagian 13 CLAUDE.md)

- Sesi idle terhapus otomatis (TTL) — memory tidak bocor.
- Rate limit & batas input aktif dan memberi pesan ramah.
- Error/timeout Gemini ditangani dengan retry + pesan ramah, server tidak crash.
- Pesan krisis → kontak darurat dijamin muncul; disclaimer & tombol darurat
  selalu terlihat.
- Balasan markdown ter-render rapi & aman (anti-XSS), tetap streaming.

---

## 11. Out of scope (YAGNI — sengaja tidak dikerjakan)

- Database / persistensi sesi (cukup in-memory untuk localhost).
- Deploy serverless / multi-instance.
- Batas panjang history (rate limit + batas input dianggap cukup).
- Autentikasi / login.
- Testing framework otomatis (cukup manual untuk scope ini).
