import { createAnthropic } from '@ai-sdk/anthropic';
import { S } from '../state.js';
import { modelFor, isThinkingRole } from '../models.js';

export function makeAnthropicModel(role) {
  const provider = createAnthropic({
    apiKey: S.apiKeys.anthropic,
    headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
  });
  return provider(modelFor(role));
}

export function getAnthropicProviderOptions(role) {
  if (!isThinkingRole(role)) {
    return { anthropic: { thinking: { type: 'disabled' } } };
  }
  // synthesis / meta — use thinking
  const model = modelFor(role);
  if (model.includes('opus')) {
    return { anthropic: { thinking: { type: 'adaptive' } } };
  }
  return { anthropic: { thinking: { type: 'enabled', budgetTokens: 4000 } } };
}
