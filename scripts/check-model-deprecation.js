#!/usr/bin/env node
// Run by .github/workflows/model-deprecation-check.yml (monthly cron +
// manual dispatch). Finds any configured model within its LiteLLM-reported
// deprecation window and opens/updates a single tracking GitHub issue.
//
// Detection only — no code changes are made automatically. LiteLLM's
// catalog gives a deprecation_date but no structured "use this instead"
// field, so picking the actual replacement model is a deliberate decision
// for a human, not something safe to guess at automatically.

import { execFileSync } from 'child_process';
import { fetchLiteLLMData, findDeprecations } from './model-config.js';

const REPO = 'DBoocock/research-swarm';
const ISSUE_TITLE = 'Model deprecation check: action needed';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

function buildBody(findings) {
  const lines = findings.map(f => {
    const when = f.daysUntil < 0 ? `**deprecated ${-f.daysUntil} days ago**` : `deprecates in ${f.daysUntil} days`;
    const sourceLine = f.source ? `\n  Source: ${f.source}` : '';
    return `- \`${f.id}\` (LiteLLM key \`${f.litellmKey}\`) — ${when} (${f.deprecationDate})${sourceLine}`;
  });
  return [
    'Automated check found model(s) approaching or past their LiteLLM-reported deprecation date.',
    '',
    ...lines,
    '',
    '**No code has been changed automatically.** LiteLLM does not provide a structured "use this instead" field, so picking the replacement model is a deliberate decision — see `src/models.js`\'s `MODELS` table and `scripts/model-config.js` for what needs updating once a replacement is chosen.',
    '',
    `_Last checked: ${new Date().toISOString()}_`,
  ].join('\n');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const data = await fetchLiteLLMData();
  const findings = findDeprecations(data);

  if (!findings.length) {
    console.log('check-model-deprecation: no findings — all configured models are clear.');
    return;
  }

  console.log(`check-model-deprecation: ${findings.length} finding(s):`);
  findings.forEach(f => console.log(`  - ${f.id}: ${f.deprecationDate}`));

  const body = buildBody(findings);
  if (dryRun) {
    console.log('\n--- --dry-run: issue body that would be created/updated ---\n');
    console.log(body);
    return;
  }

  const existing = JSON.parse(
    gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--search', `"${ISSUE_TITLE}" in:title`, '--json', 'number'])
  );

  if (existing.length) {
    gh(['issue', 'edit', String(existing[0].number), '--repo', REPO, '--body', body]);
    console.log(`check-model-deprecation: updated existing issue #${existing[0].number}`);
  } else {
    const url = gh(['issue', 'create', '--repo', REPO, '--title', ISSUE_TITLE, '--body', body]);
    console.log(`check-model-deprecation: opened new issue: ${url.trim()}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
