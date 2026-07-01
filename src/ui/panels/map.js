import { S, agents } from '../../state.js';
import { mkBtn, makeSectionLabel } from '../helpers.js';
import { tc } from '../tabs.js';

// forward-declared — set by main.js to avoid circular dependency
let _runHandover;
export function setRunHandover(fn) { _runHandover = fn; }

export function rebuildMap() {
  const p = document.getElementById('panel-map');
  p.innerHTML = '';
  if (!S.researchMap.length) {
    p.innerHTML = '<div class="empty-state"><span class="big">Research map</span>Directions appear here after synthesis.</div>';
    return;
  }
  p.appendChild(makeSectionLabel('Research directions — tag for tracking'));
  const mapById = Object.fromEntries(S.researchMap.map(r => [r.id, r]));
  const roots = S.researchMap.filter(r => !r.parentIds.length || !r.parentIds.some(pid => mapById[pid]));
  roots.forEach(item => {
    const cc = item.category.includes('DEEP') && item.category.includes('TRACTABLE') ? 'var(--success)'
      : item.category.includes('DEEP')      ? 'var(--accent3)'
      : item.category.includes('TRACTABLE') ? 'var(--accent)'
      : 'var(--text3)';
    const div = document.createElement('div');
    div.className = 'map-entry';
    const hdr = document.createElement('div');
    hdr.className = 'me-hdr';
    const lsTag = item.labelStatus === 'novel'
      ? `<span class="me-ls-tag me-ls-novel">new direction</span>`
      : (item.labelStatus === 'extends_unresolved' || item.labelStatus === 'same_as_unresolved')
        ? `<span class="me-ls-tag me-ls-unresolved">unresolved</span>`
        : '';
    hdr.innerHTML = `<span class="me-title">${item.title}</span><span class="me-meta" style="color:${cc}">${item.category}·R${item.round}</span>${lsTag}`;
    hdr.appendChild(mkBtn('handover ↓', 'sm-btn', () => _runHandover?.(item.id)));
    div.appendChild(hdr);
    const tagRow = document.createElement('div');
    tagRow.className = 'tag-row';
    [['pursue', 'tb-pursue'], ['revisit', 'tb-revisit'], ['needs-data', 'tb-needs'], ['blocked', 'tb-blocked']].forEach(([t, cls]) => {
      const tb = mkBtn(t.replace('-', ' '), `tag-btn${item.tag === t ? ' ' + cls : ''}`, () => setTag(item.id, t, cls, tb));
      tagRow.appendChild(tb);
    });
    div.appendChild(tagRow);
    if (item.summary && (item.summary.methods || item.summary.phenomenon)) {
      const sumEl = document.createElement('div');
      sumEl.className = 'me-summary';
      const parts = [];
      if (item.summary.methods)    parts.push(`methods: ${item.summary.methods}`);
      if (item.summary.phenomenon) parts.push(`phenomenon: ${item.summary.phenomenon}`);
      sumEl.textContent = parts.join('  ·  ');
      div.appendChild(sumEl);
    }
    appendChildren(div, item, 1);
    p.appendChild(div);
  });
}

export function appendChildren(container, parentItem, depth) {
  if (depth > 8) return;
  const children = S.researchMap.filter(r => r.parentIds.includes(parentItem.id));
  if (!children.length) return;
  const childList = document.createElement('div');
  childList.className = 'me-children';
  if (depth > 1) childList.style.marginLeft = '12px';
  children.forEach(child => {
    const childCc = child.category.includes('DEEP') && child.category.includes('TRACTABLE') ? 'var(--success)'
      : child.category.includes('DEEP')      ? 'var(--accent3)'
      : child.category.includes('TRACTABLE') ? 'var(--accent)'
      : 'var(--text3)';
    const childDiv  = document.createElement('div');
    childDiv.className = 'me-child-wrap';
    const childRow = document.createElement('div');
    childRow.className = 'me-child';
    childRow.innerHTML = `<span class="me-child-arrow">↳</span><span class="me-child-title">${child.title}</span><span class="me-meta" style="color:${childCc}"> ${child.category}·R${child.round}</span>`;
    childRow.appendChild(mkBtn('handover ↓', 'sm-btn', () => _runHandover?.(child.id)));
    childDiv.appendChild(childRow);
    if (child.summary && (child.summary.methods || child.summary.phenomenon)) {
      const cSumEl = document.createElement('div');
      cSumEl.className = 'me-summary me-child-summary';
      const cParts = [];
      if (child.summary.methods)    cParts.push(`methods: ${child.summary.methods}`);
      if (child.summary.phenomenon) cParts.push(`phenomenon: ${child.summary.phenomenon}`);
      cSumEl.textContent = cParts.join('  ·  ');
      childDiv.appendChild(cSumEl);
    }
    childList.appendChild(childDiv);
    appendChildren(childList, child, depth + 1);
  });
  container.appendChild(childList);
}

export function setTag(id, tag, cls, btn) {
  const entry = S.researchMap.find(r => r.id === id);
  if (!entry) return;
  entry.tag = entry.tag === tag ? null : tag;
  const row = btn.closest('.tag-row');
  row.querySelectorAll('.tag-btn').forEach(b => (b.className = 'tag-btn'));
  if (entry.tag) btn.className = 'tag-btn ' + cls;
}
