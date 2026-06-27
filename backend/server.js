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
