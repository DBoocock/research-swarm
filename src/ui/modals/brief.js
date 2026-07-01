import { brief } from '../../state.js';

export function openBriefModal() {
  document.getElementById('brief-title').value  = brief.title;
  document.getElementById('brief-subtitle').value = brief.subtitle;
  document.getElementById('brief-sys').value    = brief.sysCtx;
  document.getElementById('brief-res').value    = brief.resCtx;
  document.getElementById('brief-data').value   = brief.dataCtx;
  document.getElementById('brief-modal').classList.remove('hidden');
}

export function closeBriefModal() {
  document.getElementById('brief-modal').classList.add('hidden');
}

export function saveBrief() {
  brief.title    = document.getElementById('brief-title').value.trim();
  brief.subtitle = document.getElementById('brief-subtitle').value.trim();
  brief.sysCtx   = document.getElementById('brief-sys').value.trim();
  brief.resCtx   = document.getElementById('brief-res').value.trim();
  brief.dataCtx  = document.getElementById('brief-data').value.trim();
  document.getElementById('brief-banner-title').textContent    = brief.title;
  document.getElementById('brief-banner-subtitle').textContent = brief.subtitle;
  closeBriefModal();
}
