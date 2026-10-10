# HANDOFF — personal-buget-pwa

Actualizado: 2026-10-09 · Rama: `develop` · Versión: `1.3.0`

Lee primero `AGENTS.md` y `.agents/rules/*`.

## Estado actual

PWA offline-first (React 19, Vite 7, Dexie, Zustand). Último commit: `9538280`.

Entregado recientemente:

- **Presupuesto fijo por mes** (`9538280`): los ítems de presupuesto fijo se acotan por mes, con arrastre (carryover) y copia entre meses. Reportes actualizados para cumplimiento. Tocó `src/pages/Budget.tsx`, `src/pages/Reports.tsx`, `src/lib/db/{index,backup}.ts`, `src/lib/types.ts`.
- **i18n completo** es/en/fr: todas las vistas, formularios, ajustes, proveedores de IA, guía de usuario y toasts.
- **IA multi-proveedor BYOK**: Gemini, Claude, OpenAI, Groq (claves solo en `localStorage`).
- **Licencias**: activación en vivo con Lemon Squeezy + validador offline. CSP `connect-src` incluye `api.lemonsqueezy.com` y `api.anthropic.com`.

## Pendiente / a verificar

- `package-lock.json` tiene cambios sin commitear (2 líneas, probablemente la versión); revisar y commitear o descartar.
- Confirmar que la migración Dexie del presupuesto por mes es compatible con datos existentes y con restauración de backups antiguos (`src/lib/db/backup.ts`).
- Ejecutar `npm test` y `npm run build` antes de hacer merge de `develop` a `master`.
- Hay muchas ramas remotas `claude/*` antiguas; evaluar limpieza.

## Notas

- Copy de UI en español (con traducciones en `src/lib/i18n/translations/`); código y comentarios en inglés.
- Bumpear semver en `package.json` al shippear.
