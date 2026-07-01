import { S } from '../../state.js';

export function openRosterModal() {
  document.getElementById('roster-modal').classList.remove('hidden');
}

export function closeRosterModal() {
  document.getElementById('roster-modal').classList.add('hidden');
  document.getElementById('roster-result').textContent = '';
}
