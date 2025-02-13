import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["__tests_dom__/**/*.test.ts"],
  },
});
