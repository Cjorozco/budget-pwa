# Handoff — Personal Budget PWA

> Documento vivo. Se actualiza a petición del usuario en la sesión de Claude Code
> (https://claude.ai/code/session_01QSR3F1PLYCdmFb7HAvbmBY).
> **Última actualización:** 2026-10-02 · **Versión en producción:** 1.3.2 (`master` @ `b4b2378`, desplegada en Vercel vía merge de PR #24; despliegue no verificado desde la sesión)

## 1. Qué es
PWA de presupuesto personal, offline-first. Datos solo en el dispositivo (IndexedDB/Dexie), sin backend.
IA opcional BYOK (Gemini, Claude, OpenAI, Groq) con claves en `localStorage`. Licencias vía Lemon Squeezy + validación offline.
Idioma es/en/fr; moneda COP.

**Stack:** React 19 · TS · Vite 7 · Tailwind 4 · Dexie · Zustand (UI y licencia) · React Router · RHF + Zod · Recharts · Vitest.

## 2. Despliegue y flujo de trabajo
- `master` = producción, desplegada en **Vercel** (no hay `vercel.json` ni workflows en el repo; el despliegue lo gestiona Vercel al detectar `master`).
- Historial previo: ramas `develop` fusionadas a `master`. Hoy solo existe `master` en remoto (más la rama de trabajo de Claude).
- Reglas del repo: leer `AGENTS.md`, `.agents/rules/{working-style,ux-principles,architecture}.md`.
- SemVer en `package.json` al shippear (PATCH bugs/tests, MINOR features, MAJOR schema/backup incompatible). Dexie `version(n)` ≠ semver (actual: Dexie v9).
- Comandos: `npm ci`, `npm run build` (`tsc -b && vite build`), `npm run test:run`, `npm run lint`.

## 3. Estado actual
- PRs abiertos: 0 · Issues abiertos: 0.
- Verificación al último cambio: `tsc -b` y build OK; Vitest 31 archivos / 281 pruebas OK.
- Lint: **71 problemas preexistentes** (mayoría `no-explicit-any`, algún `no-empty`). Sin limpiar.

### Mapa del código
- `src/pages/`: Dashboard, Accounts, Transactions, Budget, Reports, Categories, Templates, AmbiguousReview, Settings.
- `src/components/forms/`: TransactionForm, TransferForm, ReconciliationForm, AccountForm, etc.
- `src/lib/db/`: `index.ts` (esquema Dexie), `backup.ts` (Zod), seeds, `migrateCategories.ts`.
- `src/lib/ai/` (gateway + categorizer), `src/lib/license/`, `src/lib/i18n/`, `src/store/`.

### Modelo de saldos (importante)
Cada `Account` guarda `calculatedBalance` (derivado de transacciones) y `actualBalance?` (saldo real declarado, ajustado por reconciliación).
El **Dashboard** calcula "Disponible" = Σ(`actualBalance ?? calculatedBalance`) − reservas. Las escrituras de saldo se hacen a mano
en `TransactionForm`, `TransferForm`, borrado en `Transactions.tsx` y `ReconciliationForm`; deben mantener ambos campos coherentes.

## 4. Cambios recientes
| Versión | Cambio |
|---|---|
| 1.3.2 | Fix: borrar una transferencia ahora revierte también `actualBalance` de la cuenta vinculada. Test `Transactions.transferDelete.test.tsx`. PR Cjorozco/budget-pwa#24 |
| 1.3.1 | Fix: `TransferForm` restaba `actualBalance` en la cuenta destino (saldo negativo y "Disponible" alterado). Test de regresión `TransferForm.test.tsx`. PR Cjorozco/budget-pwa#23 |
| 1.3.0 | Presupuesto fijo por mes con arrastre/copia y reportes de cumplimiento (Dexie v9) |
| — | i18n completo es/en/fr; proveedores IA localizados; OpenAI + activación Lemon Squeezy |

## 5. Problemas conocidos / pendientes
1. ~~Datos afectados por el bug de transferencias (≤1.3.0)~~ **Resuelto:** el usuario corrigió a mano la cuenta destino (2026-10-02). No se necesita migración.
2. ~~Borrar una transferencia no revertía `actualBalance` de la cuenta vinculada~~ **Corregido y desplegado en 1.3.2** (PR #24) con test `Transactions.transferDelete.test.tsx`.
3. Edición de transacciones (`TransactionForm`, modo edición): revisada, la lógica de `calculatedBalance`/`actualBalance` es coherente para income/expense. **Por verificar:** que el botón de editar no se ofrezca para transacciones `transfer` (en el modo edición todo lo que no es `income` se trata como gasto). Sin test dedicado.
4. Deuda de lint (71 problemas), p. ej. `updates: any` en `TransferForm`/`Transactions`.
5. README dice "270+ pruebas" (actualizado a 280+ en la rama del handoff, aún no en `master`).
6. Limpieza de datos de usuario: transferencias borradas antes de 1.3.2 pudieron dejar `actualBalance` desfasado en la cuenta vinculada; se corrige reconciliando la cuenta.

## 6. Convenciones de esta sesión
- El handoff vive solo en la rama `claude/determined-davinci-36tnp1` y **no** debe fusionarse a `master`. Para llevar fixes a producción se usan ramas limpias desde `master` (p. ej. `claude/fix-...`) con PR + squash merge.
- No usar push forzado (fue bloqueado por el clasificador de permisos); fusionar `master` a la rama del handoff con merge normal.

## 7. Cómo actualizar este documento
Pedirlo en el chat de la sesión: Claude revisa `git log`, PRs/issues y el código, y edita este archivo.
