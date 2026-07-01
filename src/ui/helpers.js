export function makeRoundHdr(title, status) {
  const div = document.createElement('div');
  div.className = 'round-hdr';
  const sc = { running: 'rs-running', done: 'rs-done', error: 'rs-error' }[status] || 'rs-running';
  div.innerHTML = `<span class="round-lbl">round</span><span class="round-title">${title}</span><span class="round-status ${sc}" id="rh-s">${status}</span>`;
  return div;
}

export function updateRoundHdr(h, status) {
  const el = h.querySelector('#rh-s');
  if (!el) return;
  el.className = 'round-status ' + ({ running: 'rs-running', done: 'rs-done', error: 'rs-error' }[status] || 'rs-running');
  el.textContent = status;
}

export function makeResultCard(title, color, bs) {
  const div = document.createElement('div');
  div.className = 'rcard';
  const bc = { running: 'b-run', done: 'b-done', pending: 'b-pend' }[bs] || 'b-pend';
  div.innerHTML = `<div class="rcard-hdr"><span class="agent-dot" style="background:${color}"></span><span class="rcard-title">${title}</span><span class="badge ${bc}">${bs}</span></div><div class="rcard-body"></div>`;
  return div;
}

export function makeDebateCard(a1, a2, type) {
  const div = document.createElement('div');
  div.className = 'rcard';
  const tc2 = { CONTRADICTION: 'pt-c', INTERSECTION: 'pt-i', DISRUPTION: 'pt-d', BRIDGE: 'pt-b' }[type] || 'pt-b';
  div.innerHTML = `<div class="rcard-hdr"><span class="agent-dot" style="background:${a1?.color || '#888'}"></span><span class="rcard-title">${a1?.name || '?'} → ${a2?.name || '?'}</span><span class="ptb ${tc2}" style="margin-left:auto">${type}</span></div><div class="rcard-body"></div>`;
  return div;
}

export function makeMatrix(dt, db, st, sb) {
  const g = document.createElement('div');
  g.className = 'matrix-grid';
  const c = (h, cls = 'mcell') => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = h;
    return d;
  };
  const q = (items, color) => {
    const d = document.createElement('div');
    d.className = 'mcell mquad';
    items.forEach(t => {
      const i = document.createElement('div');
      i.className = 'mitem';
      i.style.borderLeftColor = color;
      i.textContent = t;
      d.appendChild(i);
    });
    if (!items.length) {
      const e = document.createElement('div');
      e.style.cssText = 'font-size:10px;color:var(--text3);font-style:italic';
      e.textContent = 'none';
      d.appendChild(e);
    }
    return d;
  };
  g.appendChild(c('', 'mcell mhdr'));
  g.appendChild(c('tractable', 'mcell mhdr'));
  g.appendChild(c('blocked', 'mcell mhdr'));
  g.appendChild(c('deep', 'mcell maxs'));
  g.appendChild(q(dt, 'var(--success)'));
  g.appendChild(q(db, 'var(--accent3)'));
  g.appendChild(c('shallow', 'mcell maxs'));
  g.appendChild(q(st, 'var(--accent)'));
  g.appendChild(q(sb, 'var(--text3)'));
  return g;
}

export function makeSectionLabel(text) {
  const d = document.createElement('div');
  d.className = 'sec-label';
  d.textContent = text;
  return d;
}

export function makeNotice(text) {
  const d = document.createElement('div');
  d.className = 'notice';
  d.textContent = text;
  return d;
}

// Reusable button factory — avoids passing dynamic data through HTML onclick attributes,
// which breaks silently when LLM-generated text contains characters that confuse the
// HTML attribute parser (e.g. '/' in agent names, quotes in mandates).
export function mkBtn(text, className, handler, extraStyle) {
  const b = document.createElement('button');
  b.textContent = text;
  if (className) b.className = className;
  if (extraStyle) b.style.cssText = extraStyle;
  b.addEventListener('click', handler);
  return b;
}
