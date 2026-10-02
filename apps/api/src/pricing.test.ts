import { describe, expect, it } from 'vitest';
import { calculateTotals } from './pricing.js';

describe('pricing', () => {
  it('uses integer fils and applies a promotion before delivery threshold', () => {
    expect(calculateTotals([{ priceFils: 19950, quantity: 2 }], 10)).toEqual({ subtotalFils: 39900, discountFils: 3990, deliveryFils: 3000, totalFils: 38910 });
  });
  it('waives delivery above 50 KWD after discount', () => {
    expect(calculateTotals([{ priceFils: 60000, quantity: 1 }], 10).deliveryFils).toBe(0);
  });
});
