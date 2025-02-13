import { describe, expect, test } from "vitest";

describe('WebOmniWorker', () => {

  test('Browser test: window should be defined', () => {
    expect(window).toBeDefined();
  });

});