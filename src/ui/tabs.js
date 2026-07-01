export function lockTabs() {
  document.querySelector('.tab-bar').classList.add('tabs-locked');
}

export function unlockTabs() {
  document.querySelector('.tab-bar').classList.remove('tabs-locked');
}

export function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

export function tc(t, n) {
  const e = document.getElementById('tc-' + t);
  if (e) e.textContent = n;
}

export function setStatus(t) {
  document.getElementById('status').textContent = t;
}
