/**
 * OmniWorker Demos — Main Entry Point
 *
 * Handles tab switching logic and mounts the Vanilla, React,
 * and Svelte demo panels.  Each demo is initialised once and
 * lives in the DOM; only visibility changes via CSS class toggling.
 */

import { initVanillaDemo } from './web/vanilla';
import { initReactDemo } from './web/react';

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

/**
 * Activate the tab and panel identified by the given data-tab value.
 */
function switchTab(tabId: string): void {
  // Deactivate every tab button
  document.querySelectorAll('#tabs button').forEach((btn) => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });

  // Deactivate every panel
  document.querySelectorAll<HTMLElement>('.panel').forEach((panel) => {
    panel.classList.remove('active');
  });

  // Activate the clicked button
  const activeBtn = document.querySelector<HTMLButtonElement>(
    `#tabs button[data-tab="${tabId}"]`
  );
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
  }

  // Activate the corresponding panel
  const activePanel = document.getElementById(`${tabId}-panel`);
  if (activePanel) {
    activePanel.classList.add('active');
  }
}

/**
 * Wire up click handlers on all tab buttons.
 */
function setupTabSwitching(): void {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId) {
        switchTab(tabId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Demo mounters
// ---------------------------------------------------------------------------

/**
 * Mount the Svelte demo into the given container element.
 *
 * Dynamically imports the Svelte component so the build tooling
 * (Svelte + Vite) can process it correctly.
 */
async function initSvelteDemo(container: HTMLElement): Promise<void> {
  const { default: Demo } = await import('./web/svelte/Demo.svelte');
  new Demo({ target: container });
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Called once when the DOM is ready.  Sets up tab switching and mounts
 * all three demo panels simultaneously.
 */
async function init(): Promise<void> {
  setupTabSwitching();

  initVanillaDemo(document.getElementById('vanilla-panel') as HTMLElement);
  initReactDemo(document.getElementById('react-panel') as HTMLElement);
  await initSvelteDemo(document.getElementById('svelte-panel') as HTMLElement);
}

document.addEventListener('DOMContentLoaded', init);
