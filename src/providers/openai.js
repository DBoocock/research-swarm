import { createOpenAI } from '@ai-sdk/openai';
import { S } from '../state.js';
import { modelFor } from '../models.js';

export function makeOpenAIModel(role) {
  const provider = createOpenAI({
    apiKey: S.apiKeys.openai,
  });
  return provider(modelFor(role));
}

export function getOpenAIProviderOptions() {
  return undefined;
}
