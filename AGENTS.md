# AGENTS — personal-buget-pwa

Lee esto **antes** de explorar el repo.

## Capa de IA

**Común:** `.agents/rules/working-style.md` + `.agents/rules/ux-principles.md`  
(Cursor: `.cursor/rules/working-style.mdc` + `ux-principles.mdc`)

**Este producto:** `.agents/rules/architecture.md` (Cursor: `.cursor/rules/architecture.mdc`)

PWA offline-first (`v1.1.0`). No Convex. No Next.js.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind 4 · Dexie (IndexedDB) · Zustand (UI y Licencias) · React Router · RHF + Zod · Recharts · Vitest

## No negociable (resumen)

- **Saldos Atómicos:** Historia de transacciones. Ajustes = transacción explícita (`isAdjustment: true`).
- **Reconciliación Auditable:** No reescribe el pasado.
- **Soberanía de Datos:** Datos en el dispositivo (IndexedDB). IA Multi-proveedor BYOK opcional (Gemini, Claude, OpenAI, Groq) con claves exclusivamente en `localStorage`.
- **Licenciamiento:** Activación online vía Lemon Squeezy (store/product verificados) + revalidación periódica y gracia offline de 14 días.
- **SemVer:** Bumpear semver en `package.json` cuando el cambio se “shippea”.
