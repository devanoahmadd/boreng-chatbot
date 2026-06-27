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
