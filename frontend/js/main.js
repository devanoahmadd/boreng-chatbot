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
