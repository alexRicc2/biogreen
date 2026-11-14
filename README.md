# BIOGREEN Sustainability Assessment Platform

Official software implementation of the **BIOGREEN** quantitative green chemistry metric for circular bioeconomy materials.

## Deliverables

1. **Interactive web app** — Astro + React + TypeScript + Tailwind CSS (static export for Vercel)
2. **Desktop executables** — Tauri v2 wrappers (`.exe` / `.dmg`) built via GitHub Actions on version tags
3. **Python reference engine** — `python/biogreen_engine.py` + `python/test_biogreen.py` for manuscript Supporting Information

## Quick start

```bash
npm install
npm run dev
```

Build the static site:

```bash
npm run build
```

Run the Python reference tests:

```bash
python3 python/test_biogreen.py
# or
npm run test:python
```

## Desktop (Tauri v2)

Requires [Rust](https://rustup.rs/) and platform-native build tooling.

```bash
npm run tauri:dev
npm run tauri:build
```

CI releases are triggered by pushing a tag matching `v*` (see `.github/workflows/release.yml`).

## Project layout

```
src/                 Web UI (types, criteria config, calculator, components)
src-tauri/           Tauri v2 desktop shell
python/              Zero-dependency reference engine + tests
.github/workflows/   Windows + macOS release matrix
```
