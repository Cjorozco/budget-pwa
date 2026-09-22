# AGENTS — personal-buget-pwa

Lee esto **antes** de explorar el repo.

## Capa de IA

**Común:** `.agents/rules/working-style.md` + `.agents/rules/ux-principles.md`  
(Cursor: `.cursor/rules/working-style.mdc` + `ux-principles.mdc`)

**Este producto:** `.agents/rules/architecture.md` (Cursor: `.cursor/rules/architecture.mdc`)

PWA offline-first. No Convex. No Next.js.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind 4 · Dexie (IndexedDB) · Zustand (solo UI) · React Router · RHF + Zod · Recharts · Vitest

## No negociable (resumen)

- Saldos = historia de transacciones. Ajustes = transacción explícita (`isAdjustment: true`).
- Reconciliación no reescribe el pasado.
- Datos en el dispositivo. Gemini BYOK opcional; key solo en UI.
- Bumpear semver en `package.json` cuando el cambio se “shippea”.
