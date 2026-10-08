# Handoff — Personal Budget PWA

> Documento vivo. Se actualiza a petición del usuario en la sesión de Claude Code
> (https://claude.ai/code/session_01QSR3F1PLYCdmFb7HAvbmBY).
> **Última actualización:** 2026-10-08 (añadidos principios y librerías) · **Versión en `master`:** 1.4.2 (`2d49685`, PR #28; Vercel despliega desde `master`, despliegue no verificado desde la sesión)

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
- Verificación al último cambio: `tsc -b` y build OK; Vitest 32 archivos / 289 pruebas OK .
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
| 1.4.2 | Fix: el botón de editar ya no aparece en transferencias (antes se podían editar como gasto y desajustaban saldos). Test `Transactions.editButton.test.tsx`. PR Cjorozco/budget-pwa#28 |
| 1.4.1 | (otras sesiones, PR #25–#27) Modelos Anthropic Haiku 5.5/Haiku 4.5/Sonnet 5.5; guía de costos y tutorial por proveedor de IA en Ajustes (i18n es/en/fr); no enviar `temperature` a modelos Claude 5.x |
| 1.3.2 | Fix: borrar una transferencia ahora revierte también `actualBalance` de la cuenta vinculada. Test `Transactions.transferDelete.test.tsx`. PR Cjorozco/budget-pwa#24 |
| 1.3.1 | Fix: `TransferForm` restaba `actualBalance` en la cuenta destino (saldo negativo y "Disponible" alterado). Test de regresión `TransferForm.test.tsx`. PR Cjorozco/budget-pwa#23 |
| 1.3.0 | Presupuesto fijo por mes con arrastre/copia y reportes de cumplimiento (Dexie v9) |
| — | i18n completo es/en/fr; proveedores IA localizados; OpenAI + activación Lemon Squeezy |

## 5. Problemas conocidos / pendientes
1. ~~Datos afectados por el bug de transferencias (≤1.3.0)~~ **Resuelto:** el usuario corrigió a mano la cuenta destino (2026-10-02). No se necesita migración.
2. ~~Borrar una transferencia no revertía `actualBalance` de la cuenta vinculada~~ **Corregido y desplegado en 1.3.2** (PR #24) con test `Transactions.transferDelete.test.tsx`.
3. Edición de transacciones: la lógica de saldos de `TransactionForm` (modo edición) es coherente para income/expense. Se verificó que el botón de editar **sí se mostraba en transferencias** (las trataba como gasto y desajustaba saldos); **corregido y desplegado en 1.4.2** (PR #28) ocultándolo (las transferencias solo se borran).
4. Deuda de lint (71 problemas), p. ej. `updates: any` en `TransferForm`/`Transactions`.
5. README dice "270+ pruebas" (actualizado a 280+ en la rama del handoff, aún no en `master`).
6. Limpieza de datos de usuario: transferencias borradas antes de 1.3.2 pudieron dejar `actualBalance` desfasado en la cuenta vinculada; se corrige reconciliando la cuenta.

## 6. Principios de desarrollo y librerías
Fuente: `AGENTS.md` y `.agents/rules/{working-style,architecture,ux-principles}.md`. Leerlos antes de tocar código.

### Cómo trabajar
- Usar el stack de `package.json`; no migrar framework, backend ni librerías salvo que se pida. No inventar alcance; si algo no está en `architecture` y no es obvio, preguntar.
- TypeScript estricto, sin `any` en código nuevo. UI en español (es-CO, COP con `formatCurrency()`); código, variables y comentarios en inglés.
- Reutilizar componentes y patrones del repo; sin sobreingeniería. La UI no decide negocio: captura input, muestra estado y dispara acciones.
- Feedback inmediato (loading, `disabled` al enviar, empty, error, toasts). Acciones destructivas con `ConfirmDialog` del UI store, no `window.confirm`.
- Secretos: nunca en el repo. Claves BYOK solo en `localStorage` (nunca en `VITE_*`, Dexie ni backups).
- Salidas de IA: tratar como `unknown`, validar con Zod + grounding, con respaldo determinista. No persistir sin parseo.
- FinOps: no sugerir opciones de pago por defecto. Si cambia arquitectura, deps, API o UX, actualizar los docs.
- Versión: bumpear semver en `package.json` al shippear (PATCH bugs/tests/refactors, MINOR features/PWA/proveedores, MAJOR schema o backup incompatible).

### Dominio (no negociable)
- Saldos atómicos derivados de la historia de transacciones; los ajustes son transacciones explícitas (`isAdjustment: true`).
- La reconciliación no reescribe el pasado. Offline-first: datos solo en IndexedDB. Sin sync remoto, cuentas ni telemetría sin aprobación.
- Dexie: `useLiveQuery` en componentes (nunca async crudo en render), `db.transaction()` en escrituras multi-tabla, IDs `uuid`, índices en campos de `.where()`. Zustand solo para UI y licencia; no duplicar la DB.

### UX
- Mobile-first (sin depender de `md:`/`lg:` para funcionar), targets táctiles de al menos 44×44 px, `inputMode="decimal"` o `"numeric"` en números.
- Máximo 3 a 5 opciones a la vez; un CTA principal por vista; HTML semántico y `aria-label` si no hay texto visible.
- Flexible al capturar (trim, comas por puntos), estricto al persistir. `ErrorBoundary` y manejo de `null`/`undefined`.

### Librerías
- **Instaladas (no se reemplazan):** React 19, Vite 7, Tailwind 4, Dexie + `dexie-react-hooks`, Zustand, React Router, React Hook Form + Zod, Recharts, date-fns, Lucide, Vitest, `vite-plugin-pwa`.
- **Librería de gráficas aprobada por el usuario: TanStack Charts** (https://tanstack.com/charts/latest). Úsala para gráficas nuevas. Hoy `package.json` solo trae Recharts (`recharts ^3.8.0`) y no tiene paquetes de TanStack: las gráficas actuales siguen en Recharts hasta que se instale TanStack Charts y se decida migrarlas. Esto prima sobre el default `chart.js` de `working-style.md`.
- **Defaults para librerías nuevas** (solo si el repo no resuelve el problema): validaciones zod, fechas Temporal, tablas tanstack-table, auth better-auth, animaciones motion, tipografías fontsource, estado global zustand, drag & drop pragmatic-drag-and-drop, estado en la URL nuqs. `package.json` manda.

## 7. Convenciones de esta sesión
- Otras sesiones (p. ej. `claude/hopeful-goodall-kw7qf8`) también envían PRs a `master`: antes de ramificar, hacer `git fetch origin master` (la copia local queda obsoleta). El handoff vive solo en la rama `claude/determined-davinci-36tnp1` y **no** debe fusionarse a `master`. Para llevar fixes a producción se usan ramas limpias desde `master` (p. ej. `claude/fix-...`) con PR + squash merge.
- No usar push forzado (fue bloqueado por el clasificador de permisos); fusionar `master` a la rama del handoff con merge normal.

## 8. Cómo actualizar este documento
Pedirlo en el chat de la sesión: Claude revisa `git log`, PRs/issues y el código, y edita este archivo.
