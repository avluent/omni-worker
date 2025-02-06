/**
 * @jest-environment jsdom
 */
test('Browser test: window should be defined', () => {
  expect(window).toBeDefined();
});