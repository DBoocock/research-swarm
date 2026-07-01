import { createOpenAI } from '@ai-sdk/openai';
import { S } from '../state.js';
import { modelFor, isThinkingRole } from '../models.js';

// Injects { thinking: { type: 'disabled' } } into every DeepSeek request body.
// Needed because @ai-sdk/openai strips unknown providerOptions fields before the
// request is built. The exact parameter name should be verified against DeepSeek's
// OpenAI-compatible API docs — update the body key here if it differs.
function withThinkingDisabled(fetchFn = fetch) {
  return (url, init) => {
    try {
      const body = JSON.parse(init?.body ?? '{}');
      body.thinking = { type: 'disabled' };
      return fetchFn(url, { ...init, body: JSON.stringify(body) });
    } catch {
      return fetchFn(url, init);
    }
  };
}

let _providerNoThink = null;
let _providerThink = null;
let _lastKey = null;

function refreshProviders(key) {
  if (_lastKey === key && _providerNoThink) return;
  _lastKey = key;
  _providerNoThink = createOpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: key,
    fetch: withThinkingDisabled(),
  });
  _providerThink = createOpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: key,
  });
}

export function makeDeepSeekModel(role) {
  const key = S.apiKeys.deepseek;
  refreshProviders(key);
  const provider = (isThinkingRole(role) && S.deepseekThinking) ? _providerThink : _providerNoThink;
  return provider.chat(modelFor(role));
}

export function getDeepSeekProviderOptions() {
  return undefined;
}
