import { describe, expect, test } from "vitest";
import { convertToJsUrl } from '../src/web/builder/helpers';

describe('WebOmniWorker', () => {

  test('Browser test: window should be defined', () => {
    expect(window).toBeDefined();
  });

  describe('Helper functions', () => {

    test('A tsURL is converted to a jsURL', () => {
      let tsUrl = new window.URL('http://localhost:5000/workers/test.worker.ts');

      const jsURL = convertToJsUrl(tsUrl, '.js');
      expect(jsURL.pathname.endsWith('.js')).toBeTruthy();

      tsUrl = new window.URL('http://localhost:5000/workers/test.worker.ts');

      const anotherJsUrl = convertToJsUrl(tsUrl, '.mjs');
      expect (anotherJsUrl.pathname.endsWith('.mjs')).toBeTruthy();
    });
  });

});