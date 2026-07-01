import { S } from '../state.js';
import { makeAnthropicModel, getAnthropicProviderOptions } from './anthropic.js';
import { makeGeminiModel, getGeminiProviderOptions } from './gemini.js';
import { makeDeepSeekModel, getDeepSeekProviderOptions } from './deepseek.js';
import { makeOpenAIModel, getOpenAIProviderOptions } from './openai.js';

export function getModel(role) {
  const p = S.provider || 'gemini';
  switch (p) {
    case 'anthropic': return makeAnthropicModel(role);
    case 'gemini':    return makeGeminiModel(role);
    case 'deepseek':  return makeDeepSeekModel(role);
    case 'openai':    return makeOpenAIModel(role);
    default: throw new Error(`Unknown provider: ${p}`);
  }
}

export function getCallProviderOptions(role) {
  const p = S.provider || 'gemini';
  switch (p) {
    case 'anthropic': return getAnthropicProviderOptions(role);
    case 'gemini':    return getGeminiProviderOptions();
    case 'deepseek':  return getDeepSeekProviderOptions();
    case 'openai':    return getOpenAIProviderOptions();
    default: return undefined;
  }
}
