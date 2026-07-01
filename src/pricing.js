import { PRICING } from './generated/pricing.js';

export { PRICING };

export function priceFor(model) {
  return PRICING[model] || PRICING['claude-sonnet-4-6'];
}
