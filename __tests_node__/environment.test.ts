import { describe, test, expect } from 'vitest';

describe('environment', () => {
  test('we are on nodeJS', () => {
    expect(process).toBeDefined();
  });
});