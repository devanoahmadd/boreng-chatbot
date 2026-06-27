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
