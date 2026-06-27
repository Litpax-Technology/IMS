// ============================================================
// Litpax IMS Agent — agent.js
// ============================================================

const IMS_API = 'https://script.google.com/macros/s/AKfycbwZIb1KolVqxlqO8NsTsqx3j6wJ4juHows43Kb1vGxGkX45eyxNTMEriw4tgZN_RNGP/exec';

let _imsOpen     = false;
let _imsLoading  = false;
let _imsLoaded   = false;
let _imsStocks   = [];
let _imsInward   = [];
let _imsOutward  = [];

// ── TOGGLE ──
function imsToggle() {
  _imsOpen = !_imsOpen;
  document.getElementById('ims-fab').classList.toggle('open', _imsOpen);
  document.getElementById('ims-popup').classList.toggle('open', _imsOpen);
  if (_imsOpen) {
    document.getElementById('ims-inp').focus();
    if (!_imsLoaded) imsFetch();
  }
}

// ── TIMESTAMP ──
function imsTs() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ── ADD MESSAGE ──
function imsAddMsg(text, role, loading) {
  const wrap = document.getElementById('ims-msgs');
  const d = document.createElement('div');
  d.className = 'im ' + (role === 'user' ? 'u' : 'b');
  d.innerHTML = `<div class="ib${loading ? ' loading' : ''}">${text}</div><div class="its">${imsTs()}</div>`;
  wrap.appendChild(d);
  wrap.scrollTop = wrap.scrollHeight;
  return d;
}

// ── TODAY ──
function imsToday() { return new Date().toISOString().slice(0, 10); }

// ── FETCH LIVE DATA ──
async function imsFetch() {
  const dot = document.getElementById('ims-dot');
  dot.className = '';
  try {
    const [dash, inw, out] = await Promise.all([
      fetch(`${IMS_API}?action=getDashboard`, { redirect: 'follow' }).then(r => r.json()),
      fetch(`${IMS_API}?action=getInward`,    { redirect: 'follow' }).then(r => r.json()),
      fetch(`${IMS_API}?action=getOutward`,   { redirect: 'follow' }).then(r => r.json()),
    ]);
    _imsStocks  = dash.stocks || [];
    _imsInward  = Array.isArray(inw) ? inw : [];
    _imsOutward = Array.isArray(out) ? out : [];
    _imsLoaded  = true;
    dot.className = 'on';
  } catch (e) {
    dot.className = 'err';
  }
}

// ── BUILD CONTEXT FOR AI ──
function imsBuildContext() {
  const t        = imsToday();
  const todayIn  = _imsInward.filter(r => r.date === t);
  const todayOut = _imsOutward.filter(r => r.date === t);
  const critical = _imsStocks.filter(s => s.status === 'Critical');
  const reorder  = _imsStocks.filter(s => s.status === 'Reorder');
  const wip      = _imsStocks.filter(s => (s.wip || 0) > 0);

  return `Aaj ki date: ${t}
Total items: ${_imsStocks.length}
Critical (${critical.length}): ${critical.map(s => s.name + '=' + s.currentStock + s.unit).join(', ') || 'None'}
Reorder  (${reorder.length}): ${reorder.map(s => s.name + '=' + s.currentStock + s.unit).join(', ') || 'None'}
WIP      (${wip.length}): ${wip.map(s => s.name + '=' + s.wip).join(', ') || 'None'}
Aaj Inward : ${todayIn.map(r => r.itemName + ':+' + r.qty + (r.unit || '')).join(', ') || 'Koi nahi'}
Aaj Outward: ${todayOut.map(r => r.itemName + ':-' + r.qty + (r.unit || '')).join(', ') || 'Koi nahi'}

FULL STOCK:
${_imsStocks.map(s =>
  `${s.name} | cat:${s.cat} | stock:${s.currentStock}${s.unit || ''} | wip:${s.wip || 0} | rop:${s.reorderPoint} | status:${s.status}`
).join('\n')}`;
}

// ── QUICK ASK (chips) ──
function imsAsk(q) {
  document.getElementById('ims-inp').value = q;
  imsSend();
}

// ── SEND ──
async function imsSend() {
  const q = document.getElementById('ims-inp').value.trim();
  if (!q || _imsLoading) return;

  document.getElementById('ims-inp').value = '';
  _imsLoading = true;
  document.getElementById('ims-send').disabled = true;

  imsAddMsg(q, 'user');
  const loadEl = imsAddMsg('Soch raha hoon...', 'bot', true);

  try {
    if (!_imsLoaded) await imsFetch();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: `Tu Litpax Technology Pvt. Ltd. ka IMS (Inventory Management System) Assistant hai. Litpax Rohtak, Haryana mein lithium battery banati hai.

Tujhe Hinglish mein jawab dena hai — friendly, short aur clear. Numbers ke saath units likho. Agar item nahi mila toh bol "yeh item IMS mein nahi mila". Partial name se bhi dhundo.

Status matlab:
- Critical = stock bilkul khatam hone wala hai, turant order karo
- Reorder = order lagao
- OK = stock theek hai

LIVE INVENTORY DATA:
${imsBuildContext()}`,
        messages: [{ role: 'user', content: q }]
      })
    });

    const d = await res.json();
    const reply = (d.content && d.content[0] && d.content[0].text) || 'Kuch gadbad hui, dobara try karo.';

    loadEl.querySelector('.ib').textContent = reply;
    loadEl.querySelector('.ib').classList.remove('loading');

  } catch (e) {
    loadEl.querySelector('.ib').textContent = 'Error: ' + (e.message || 'Network issue');
    loadEl.querySelector('.ib').classList.remove('loading');
    loadEl.querySelector('.ib').style.color = '#dc2626';
  }

  _imsLoading = false;
  document.getElementById('ims-send').disabled = false;
  document.getElementById('ims-msgs').scrollTop = 9999;
}
