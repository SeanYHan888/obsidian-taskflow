# TypeScript 5 + Svelte 5 + esbuild + Vitest

Rebuilding the plugin from the ground up (2026-08), we chose Svelte 5 (runes) over React/Preact/Solid/vanilla: the plugin must stay small and instant in a sidebar on desktop *and* mobile (~10–15 kB compiled vs ~45 kB React runtime), signal-based reactivity fits a live-filtering panel, and the inherited Checklist components whose look we keep are already Svelte, so their markup/CSS port as a guide. TypeScript 5 strict, esbuild for bundling (Obsidian-standard single `main.js`), Vitest with fake timers for date-boundary tests.

The bet is deliberately small: `src/core/` (section classification, date rules, line-move logic) is pure TS with zero framework imports, so swapping the UI layer later would strand nothing but thin components.

Considered and rejected: React (ecosystem and agent fluency, but heaviest runtime for a minimalist mobile-capable panel), Preact (close second; JSX + compat ecosystem at 4 kB, no porting benefit from the Svelte fork), SolidJS (Svelte-like reactivity without the template ergonomics or ecosystem), vanilla Obsidian DOM helpers (select-mode and reactive counts would mean hand-rolled DOM bookkeeping).
