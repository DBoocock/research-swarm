import { S, _handoverContent, _handoverTitle } from '../../state.js';

export function openHandoverModal() {
  document.getElementById('handover-modal').classList.remove('hidden');
}

export function updateHandoverModal(content) {
  document.getElementById('handover-content').textContent = content;
}

export function closeHandoverModal() {
  document.getElementById('handover-modal').classList.add('hidden');
}

export function downloadHandover() {
  const text = document.getElementById('handover-content').textContent;
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (_handoverTitle || 'handover') + '.md';
  a.click();
  URL.revokeObjectURL(url);
}
