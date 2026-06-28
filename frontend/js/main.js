// Boreng — logika frontend: switch layar, kirim pesan, baca SSE, render markdown aman.
const SESSION_ID = crypto.randomUUID();

// Avatar kecil Boreng untuk tiap bubble (head-only, kebaca di ukuran kecil).
const AVATAR_SVG = `
  <svg viewBox="22 16 76 54" width="24" height="17" aria-hidden="true">
    <path d="M40 30 L33 12 L55 26 Z" fill="#463a42"/><path d="M80 30 L87 12 L65 26 Z" fill="#463a42"/>
    <circle cx="48" cy="46" r="5" fill="#f4ecee"/><circle cx="72" cy="46" r="5" fill="#f4ecee"/>
    <circle cx="49.4" cy="44.4" r="1.7" fill="#c4707b"/><circle cx="73.4" cy="44.4" r="1.7" fill="#c4707b"/>
    <path d="M56 53 l8 0 -4 4 z" fill="#e59aa3"/>
  </svg>`;

const welcome  = document.getElementById('welcome');
const chat     = document.getElementById('chat');
const form     = document.getElementById('chat-form');
const input    = document.getElementById('user-input');
const chatBox  = document.getElementById('chat-box');
const sendBtn  = document.getElementById('send-btn');
const starters = document.getElementById('starters');

function scrollDown(){ chatBox.scrollTop = chatBox.scrollHeight; }

// Pindah dari welcome ke chat.
function showChat(){
  welcome.hidden = true;
  chat.hidden = false;
  input.focus();
}

// Bubble user — selalu textContent (aman, tanpa markdown).
function appendUser(text){
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  chatBox.appendChild(el);
  scrollDown();
}

// Baris Boreng: avatar + bubble (awalnya indikator ngetik). Mengembalikan bubble-nya.
function appendBoreng(){
  const row = document.createElement('div');
  row.className = 'row';
  const av = document.createElement('div');
  av.className = 'avatar avatar-sm';
  av.innerHTML = AVATAR_SVG;
  const bubble = document.createElement('div');
  bubble.className = 'msg boreng';
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  row.appendChild(av);
  row.appendChild(bubble);
  chatBox.appendChild(row);
  scrollDown();
  return bubble;
}

// Render markdown aman ke bubble Boreng.
function renderBoreng(el, buffer){
  el.innerHTML = DOMPurify.sanitize(marked.parse(buffer));
}

function setStreaming(on){
  sendBtn.disabled = on;
  input.disabled = on;
  if (!on) input.focus();
}

// Kirim satu pesan & baca stream SSE.
async function sendMessage(text){
  text = (text || '').trim();
  if (!text) return;

  if (starters) starters.hidden = true; // sembunyikan starter setelah pesan pertama
  appendUser(text);
  input.value = '';
  setStreaming(true);

  const bubble = appendBoreng();
  let buffer = '';
  let firstChunk = true;

  try{
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ sessionId:SESSION_ID, message:text }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf = '';

    while (true){
      const { value, done } = await reader.read();
      if (done) break;
      sseBuf += decoder.decode(value, { stream:true });
      const lines = sseBuf.split('\n');
      sseBuf = lines.pop();

      for (const line of lines){
        if (!line.startsWith('data:')) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr) continue;
        let payload;
        try{ payload = JSON.parse(payloadStr); } catch{ continue; }

        if (payload.text){
          if (firstChunk){ buffer = ''; firstChunk = false; }
          buffer += payload.text;
          renderBoreng(bubble, buffer);
          scrollDown();
        } else if (payload.error){
          buffer += `\n\n_${payload.error}_`;
          renderBoreng(bubble, buffer);
          firstChunk = false;
          scrollDown();
        }
      }
    }
    if (firstChunk){ bubble.textContent = 'Hmm, Boreng nggak sempat jawab. Coba lagi ya 💙'; }
  } catch(err){
    console.error('[Boreng]', err);
    bubble.textContent = 'Yah, koneksinya putus. Coba lagi ya 💙';
  } finally{
    setStreaming(false);
    scrollDown();
  }
}

// Submit form → kirim isi input.
form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

// Peta mood → pesan-user pembuka (mood jadi konteks pertama buat Boreng).
const MOOD_MESSAGE = {
  Sedih:   'Aku lagi sedih banget.',
  Hampa:   'Aku ngerasa hampa, kayak kosong gitu.',
  Capek:   'Aku capek banget, lahir batin.',
  Cemas:   'Aku lagi cemas dan kepikiran terus.',
  Marah:   'Aku lagi marah dan kesel sama keadaan.',
  Bingung: 'Aku bingung, nggak tahu harus gimana.',
};

// Pilih mood → buka chat + kirim pesan pembuka sesuai mood.
document.getElementById('mood-list').addEventListener('click', (e) => {
  const chip = e.target.closest('.mood-chip');
  if (!chip) return;
  showChat();
  sendMessage(MOOD_MESSAGE[chip.dataset.mood] || chip.dataset.mood);
});

// Link "langsung cerita aja" → buka chat kosong (starter chips terlihat).
document.getElementById('welcome-skip').addEventListener('click', showChat);

// Starter chip → kirim teksnya sebagai pesan.
starters.addEventListener('click', (e) => {
  const chip = e.target.closest('.starter-chip');
  if (!chip) return;
  sendMessage(chip.textContent);
});
