# Functional Requirement: FR009 — Browser Web Worker Support

## ID
FR009

## Title
Browser Web Worker Support

## Category
Functional — Environment Adapter

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **browser developer**, I would like **to use OmniWorker with Web Workers transparently**, in order to **keep the main UI thread responsive by offloading heavy computations**.

## Definition of Done
- [ ] `omniWorker()` auto-detects browser and creates `new Worker()`
- [ ] Uses `type: 'module'` for ES module workers
- [ ] Bundled worker code is delivered via data URL or Vite asset URL
- [ ] Standard Comlink `wrap(worker)` is used (no adapter needed)
- [ ] Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- [ ] `navigator.hardwareConcurrency` is available as default pool count suggestion
- [ ] Service Worker context is NOT supported (documented limitation)

## Priority
1 (Critical)

## Specification

### Worker Creation

```
┌────────────────────────────────────────────────────────────┐
│  Browser Web Worker                                        │
│                                                            │
│  new Worker(workerUrl, {                                   │
│    type: 'module',                                         │
│  })                                                        │
│                                                            │
│  workerUrl options:                                        │
│    - Data URL: data:text/javascript;base64,... (dev)       │
│    - Asset URL: /assets/worker-hash.js (prod)              │
└────────────────────────────────────────────────────────────┘
```

### URL Resolution Strategy

| Mode | URL Type | How It Works |
|------|----------|-------------|
| Dev (Vite HMR) | Data URL | esbuild bundles → base64 encode → `data:text/javascript;base64,...` |
| Production | Asset URL | Vite emits file to `dist/` → returns public URL |

| Consideration | Decision |
|---------------|----------|
| Data URL size limit | Most browsers support 2MB+; warn if bundle exceeds 1MB |
| Same-origin policy | Workers loaded via data URL inherit main page origin |
| CORS | Not applicable for data URLs; relevant for asset URLs |

### Comlink Integration

| Component | Import Path | Purpose |
|-----------|------------|---------|
| Main thread | `comlink` (ESM) | `Comlink.wrap(worker)` |
| Worker side | `comlink` (bundled) | `Comlink.expose(api)` |
| No adapter needed | — | Web Worker has native `postMessage` |

### Browser Compatibility

| Browser | Web Worker | ESM Workers (`type: 'module'`) | Status |
|---------|-----------|-------------------------------|--------|
| Chrome 89+ | Yes | Yes | Supported |
| Firefox 79+ | Yes | Yes | Supported |
| Safari 14.1+ | Yes | Yes | Supported |
| Edge 89+ | Yes | Yes | Supported |
| Safari < 14.1 | Yes | No | Limitation documented |

### Worker Scope

| Capability | Available in Worker | Notes |
|-----------|-------------------|-------|
| `fetch()` | Yes | Workers have full fetch API |
| `setTimeout` / `setInterval` | Yes | Standard timer APIs |
| `console.*` | Partial | `console.log` works, but output goes to main page console |
| `localStorage` / `sessionStorage` | No | Not available in workers |
| DOM access | No | Workers are DOM-less |
| `WebSocket` | Yes | Full WebSocket support |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Browser doesn't support Workers | `typeof Worker === 'undefined'` | Throws `OmniWorkerError: Web Workers not supported` |
| ESM workers not supported | Safari < 14.1 | Throws `OmniWorkerError` with browser upgrade suggestion |
| Data URL too large | Bundled worker > browser limit | Build warning, fallback to file-based worker |
| Same-origin violation | Worker loaded from different origin | Standard browser CORS error |
| Service Worker context | Library used inside Service Worker | Throws `OmniWorkerError: Not supported in Service Worker context` |

### Tests

| Test | Assertion |
|------|-----------|
| Worker created in jsdom | `Worker` is instantiated correctly |
| Message passing works | `use().add(1,2)` resolves to `3` |
| Data URL worker | Worker starts from data URL string |
| Pool in browser | Multiple workers created and round-robin works |
| Browser compatibility check | Throws descriptive error on unsupported browser |
| Worker destroy | `terminate()` called, worker is gone |
