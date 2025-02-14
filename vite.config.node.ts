import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests_node__/**/*.test.ts"],
    pool: 'forks',
  },
});
