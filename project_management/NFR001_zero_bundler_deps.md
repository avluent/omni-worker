# Non-Functional Requirement: NFR001 — Zero Bundler Peer Dependencies

## ID
NFR001

## Title
Zero Bundler Peer Dependencies

## Category
Non-Functional — Dependency Management

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **library maintainer**, I would like **the library to have zero peer dependencies on bundlers (webpack, babel, terser)**, in order to **eliminate version conflicts and reduce the installation friction for consumers**.

## Definition of Done
- [ ] `peerDependencies` in `package.json` contains only `comlink` (optional) and `vite` (peer, since plugin targets it)
- [ ] No webpack, babel-loader, @babel/*, terser-webpack-plugin, or webpack-node-externals in peerDependencies
- [ ] esbuild is a regular `dependency` (or devDependency bundled into the package), NOT a peer dependency
- [ ] Installing the library requires only `npm install @anonaddy/omni-worker` (plus vite if not already present)
- [ ] No post-install scripts that resolve or install additional packages

## Priority
1 (Critical)

## Specification

### Dependency Table

| Package | Type | Justification |
|---------|------|---------------|
| `comlink` | `dependency` | Core communication layer, always needed at runtime |
| `esbuild` | `dependency` | Used by Vite plugin for build-time bundling. Ships with prebuilt binaries. |
| `vite` | `peerDependency` | Plugin targets Vite's API. Consumer must already have Vite. |
| `typescript` | `devDependency` | Only needed for building the library itself |

| Package (v0.x) | v2.0 Status | Rationale |
|----------------|-------------|-----------|
| `webpack` | Removed | Replaced by esbuild in Vite plugin |
| `babel-loader` | Removed | esbuild handles TypeScript natively |
| `@babel/preset-*` | Removed | Not needed |
| `@babel/plugin-*` | Removed | Not needed |
| `terser-webpack-plugin` | Removed | Vite handles minification |
| `webpack-node-externals` | Removed | Not needed |

### Install Size Impact

| Metric | v0.x | v2.0 |
|--------|------|------|
| Direct dependencies | 0 (all peer) | 2 (comlink, esbuild) |
| Peer dependencies | 9 | 2 (comlink, vite) |
| Install command | `npm i @anonaddy/omni-worker webpack babel-loader @babel/preset-env @babel/preset-typescript @babel/plugin-transform-modules-commonjs @babel/plugin-proposal-decorators terser-webpack-plugin webpack-node-externals comlink` | `npm i @anonaddy/omni-worker` |
| Version conflict risk | High (9 packages to align) | Low (2 packages) |

### Compliance

- **ISO/IEC 25010 (Modifiability)**: Reducing peer dependency surface makes the library easier to maintain and integrate
- **npm best practices**: Peer dependencies should be truly optional or commonly installed. Bundlers are not.

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| esbuild native binary missing | Consumer platform has no prebuilt esbuild binary | esbuild falls back to `esbuild-wasm` automatically |
| Comlink version mismatch | Consumer has incompatible comlink version | Documented minimum version in README |
| Vite version mismatch | Consumer has old Vite version | Plugin checks Vite version, warns if incompatible |

### Tests

| Test | Assertion |
|------|-----------|
| package.json audit | No bundler packages in peerDependencies |
| Fresh install works | `npm i @anonaddy/omni-worker` succeeds without additional packages |
| esbuild resolves | esbuild is importable from the library |
| Comlink resolves | comlink is importable from the library |
