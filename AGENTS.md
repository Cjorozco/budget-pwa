# AGENTS — personal-buget-pwa

Lee esto **antes** de explorar el repo.

## Capa de IA

**Común a todos los proyectos** (fuente: <https://app.notion.com/p/3f3aa39f8dab81bc80fadd7c6515a087>):
`.agents/rules/working-style.md` + `.agents/rules/ux-principles.md`
(Cursor: `.cursor/rules/working-style.mdc` + `ux-principles.mdc`)

**Este producto** (stack, dominio, excepciones a la capa común):
`.agents/rules/architecture.md` (Cursor: `.cursor/rules/architecture.mdc`)

PWA offline-first. No Convex. No Next.js. Versión y scripts: `package.json`.

## Stack

React 19 · TypeScript · Vite 7 · Tailwind 4 · Dexie (IndexedDB) · Zustand (UI y Licencias) · React Router · RHF + Zod · TanStack Charts · Vitest

## No negociable

Saldos atómicos, reconciliación auditable, soberanía de datos, licenciamiento y SemVer: ver `architecture.md`.

## Mantenimiento de las reglas

`.cursor/rules/*.mdc` es espejo de `.agents/rules/*.md` (mismo contenido, solo cambia el frontmatter). Al editar uno, actualiza el otro.
