import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { S } from '../state.js';
import { modelFor } from '../models.js';

export function makeGeminiModel(role) {
  const provider = createGoogleGenerativeAI({
    apiKey: S.apiKeys.gemini,
  });
  return provider(modelFor(role));
}

// Disable thinking for all Gemini calls — thinking tokens consume the maxOutputTokens
// budget and cause mid-sentence truncation for our structured-output tasks.
export function getGeminiProviderOptions() {
  return { google: { thinkingConfig: { thinkingBudget: 0 } } };
}
