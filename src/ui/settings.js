import { S } from '../state.js';
import { setStatus } from './tabs.js';

export function setProvider(p) {
  S.provider = p;
  // Show exactly one key-section for the active provider
  ['gemini', 'anthropic', 'deepseek', 'openai'].forEach(name => {
    const el = document.getElementById('key-section-' + name);
    if (el) el.style.display = p === name ? '' : 'none';
  });
  // Synthesis-model picker only applies to multi-tier providers (not Gemini)
  const synthSection = document.getElementById('synth-model-section');
  if (synthSection) synthSection.style.display = p === 'gemini' ? 'none' : '';
  if (!S.currentRound) {
    const hints = {
      gemini:    'Ready. Add a Gemini API key to begin.',
      anthropic: 'Ready. Add your Anthropic API key to begin.',
      deepseek:  'Ready. Add a DeepSeek API key to begin.',
      openai:    'Ready. Add an OpenAI API key to begin.',
    };
    setStatus(hints[p] || 'Ready.');
  }
  // Update provider-button active state
  document.querySelectorAll('.provider-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.provider === p);
  });
}

export function setDepth(d) {
  S.depth = d;
  document.querySelectorAll('.depth-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.depth === d);
  });
}

export function setSynthModel(m) {
  S.synthesisModel = m;
  document.getElementById('synth-sonnet-btn')?.classList.toggle('active', m === 'sonnet');
  document.getElementById('synth-opus-btn')?.classList.toggle('active', m === 'opus');
}
