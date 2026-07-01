/**
 * Type declarations for Svelte component imports.
 *
 * Allows TypeScript to resolve `.svelte` file imports when they are
 * processed by the Svelte Vite plugin at build time.
 */
declare module '*.svelte' {
  import type { SvelteComponent } from 'svelte';
  export default SvelteComponent;
}
