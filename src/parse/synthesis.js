import { S } from '../state.js';
import { rebuildMap } from '../ui/panels/map.js';
import { tc } from '../ui/tabs.js';
import { rebuildContradictions } from '../ui/panels/contradictions.js';
import { rebuildMatrix } from '../ui/panels/matrix.js';

// ─── FROZEN — do not modify without explicit instruction ───────────────────
// workingMap/existingMap snapshot, extends_unresolved/same_as_unresolved
// states, and all edge-case comment blocks are intentionally preserved.
export function parseSynthesis(text) {
  const existingMap = [...S.researchMap];
  let mapCount = 0;
  let lastNewEntry = null;
  const newEntries   = [];
  const reusedEntries = [];
  const workingMap   = [];

  for (const line of text.split('\n')) {
    const dirMatch = line.match(/\[([A-Z]+)\+([A-Z]+)\]\s*(.+)/);
    if (dirMatch) {
      const depth = dirMatch[1].includes('DEEP') ? 'DEEP' : dirMatch[1].includes('SHALLOW') ? 'SHALLOW' : null;
      const tract = dirMatch[2].includes('TRACTABLE') ? 'TRACTABLE' : dirMatch[2].includes('BLOCKED') ? 'BLOCKED' : null;
      if (!depth || !tract) { lastNewEntry = null; continue; }
      const cat = `${depth}+${tract}`;
      const rawTitle = dirMatch[3]
        .replace(/^[\s\-–•\d.*]+/, '')
        .replace(/\*+$/, '')
        .trim();

      if (rawTitle) {
        const existingPrior     = existingMap.find(r => r.title === rawTitle);
        const existingSameRound = workingMap.find(r => r.title === rawTitle);
        if (!existingPrior && !existingSameRound) {
          const entry = {
            id: `R${S.currentRound}-${mapCount}`,
            title: rawTitle,
            category: cat,
            round: S.currentRound,
            tag: null,
            agents: [],
            debateRefs: [],
            parentIds: [],
            summary: null,
            labelStatus: 'unlabeled',
          };
          newEntries.push(entry);
          workingMap.push(entry);
          lastNewEntry = entry;
          mapCount++;
        } else {
          const existing = existingPrior || existingSameRound;
          if (existingPrior && !reusedEntries.includes(existingPrior)) {
            reusedEntries.push(existingPrior);
          }
          lastNewEntry = null;
        }
      } else {
        lastNewEntry = null;
      }
    } else {
      const summaryMatch      = line.match(/^\s*SUMMARY:\s*(.+)$/i);
      const sameAsMatch       = line.match(/^\s*SAME AS:\s*(R\d+-\d+)/i);
      // Accept NEW DIRECTION (current label) and bare NOVEL (backward-compat)
      const novelMatch        = line.match(/^\s*(?:NEW DIRECTION|NOVEL)\b/i);
      // Fallback: model wrote EXTENDS: NOVEL or EXTENDS: NEW DIRECTION
      const extendsNovelMatch = line.match(/^\s*EXTENDS:\s*(?:NOVEL|NEW DIRECTION)\b/i);
      const extendsMatch      = line.match(/^\s*EXTENDS:\s*(R\d+-\d+)/i);

      // SAME AS retracts a provisionally-created entry and merges it into
      // the referenced existing entry — handles acronym/reordering variants
      // that exact-title matching misses.
      if (sameAsMatch && lastNewEntry) {
        const refId = sameAsMatch[1];
        const ref   = existingMap.find(e => e.id === refId);
        if (ref) {
          const ni = newEntries.indexOf(lastNewEntry);
          if (ni !== -1) newEntries.splice(ni, 1);
          const wi = workingMap.indexOf(lastNewEntry);
          if (wi !== -1) workingMap.splice(wi, 1);
          if (!reusedEntries.includes(ref)) reusedEntries.push(ref);
        } else {
          // Unresolved: model referenced a same-round or non-existent ID
          lastNewEntry.labelStatus = 'same_as_unresolved';
        }
        lastNewEntry = null;
      }

      if (summaryMatch && lastNewEntry) {
        const raw = summaryMatch[1].trim();
        const methodsM = raw.match(/methods?\s*=\s*([^;]+)/i);
        const phenomM  = raw.match(/phenomenon\s*=\s*([^;]+)/i);
        lastNewEntry.summary = {
          methods:    methodsM ? methodsM[1].trim() : '',
          phenomenon: phenomM  ? phenomM[1].trim()  : (methodsM ? '' : raw),
        };
      }

      if (extendsMatch && lastNewEntry) {
        const parentId = extendsMatch[1];
        const parent   = existingMap.find(e => e.id === parentId);
        if (parent) {
          if (!lastNewEntry.parentIds.includes(parent.id)) lastNewEntry.parentIds.push(parent.id);
          lastNewEntry.labelStatus = 'extends';
        } else {
          // Unresolved: almost always a same-round sibling reference
          lastNewEntry.labelStatus = 'extends_unresolved';
        }
      }

      if (novelMatch && lastNewEntry) {
        lastNewEntry.labelStatus = 'novel';
      }

      if (extendsNovelMatch && lastNewEntry) {
        // Model wrote EXTENDS: NOVEL or EXTENDS: NEW DIRECTION — honour the intent
        lastNewEntry.labelStatus = 'novel';
      }

      // End the current entry window only on a genuinely unrelated non-empty line
      if (line.trim() && !summaryMatch && !sameAsMatch && !novelMatch && !extendsNovelMatch && !extendsMatch) {
        lastNewEntry = null;
      }
    }
  }

  // Commit surviving new entries to the research map
  newEntries.forEach(e => S.researchMap.push(e));
  rebuildMap();
  tc('map', S.researchMap.length);

  // Contradictions — handle both plain and bold markdown formats:
  // "AGENT vs AGENT: ..." and "**AGENT vs. AGENT:**  ..."
  const contraText = (text.match(/CONTRADICTIONS[\s\S]*$/i)?.[0] || text);
  const contraPattern = /\*{0,2}([^*\n|]+?)\s+vs\.?\s+([^*:\n|]+?)\*{0,2}\s*:\s*([^|\n]+)\|\s*([^|\n]+)\|\s*Resolution needed:\s*([^\n]+)/gi;
  for (const m of contraText.matchAll(contraPattern)) {
    const a1 = m[1].replace(/\*/g, '').trim();
    const a2 = m[2].replace(/\*/g, '').trim();
    const e  = { a1, a2, claim1: m[3].trim(), claim2: m[4].trim(), resolution: m[5].trim(), round: S.currentRound };
    if (!S.contradictions.find(c => c.claim1 === e.claim1)) S.contradictions.push(e);
  }
  rebuildContradictions();
  tc('contra', S.contradictions.length || '!');

  // Matrix — strip leading asterisks from titles
  const dt = [], db = [], st = [], sb = [];
  for (const m of text.matchAll(/\[([A-Z]+)\+([A-Z]+)\]\s*([^\n]+)/g)) {
    const depth = m[1].includes('DEEP') ? 'DEEP' : m[1].includes('SHALLOW') ? 'SHALLOW' : null;
    const tract = m[2].includes('TRACTABLE') ? 'TRACTABLE' : m[2].includes('BLOCKED') ? 'BLOCKED' : null;
    if (!depth || !tract) continue;
    const t = m[3].replace(/^[\s\-–•\d.*]+/, '').trim();
    if (depth === 'DEEP'    && tract === 'TRACTABLE') dt.push(t);
    else if (depth === 'DEEP'    && tract === 'BLOCKED')    db.push(t);
    else if (depth === 'SHALLOW' && tract === 'TRACTABLE')  st.push(t);
    else sb.push(t);
  }
  S.matrix = { dt, db, st, sb };
  rebuildMatrix();

  return { newEntries, reusedEntries };
}
