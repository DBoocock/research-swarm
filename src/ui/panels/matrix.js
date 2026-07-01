import { S } from '../../state.js';
import { makeMatrix, makeSectionLabel } from '../helpers.js';

export function rebuildMatrix() {
  const p = document.getElementById('panel-matrix');
  p.innerHTML = '';
  p.appendChild(makeSectionLabel('Depth / tractability matrix (latest synthesis)'));
  p.appendChild(makeMatrix(S.matrix.dt || [], S.matrix.db || [], S.matrix.st || [], S.matrix.sb || []));
}
