# Handoff — Personal Budget PWA

**Para qué sirve:** retomar el desarrollo en una sesión nueva, o con otra persona, sin perder contexto ni depender de que el dueño lo explique.
Cubre: qué es el producto y cómo está armado · estado real (producción y pendientes) · reglas de negocio · comandos · próximos pasos · forma de trabajar.
Es corto a propósito (ahorra tokens). El historial detallado vive en `git log` y en los PRs; aquí no se duplica.

> **Última actualización:** 2026-10-08 · **Producción:** `master` v1.4.2 (`7046cca`) · Repo: Cjorozco/budget-pwa

## 1. Qué es y cómo está armado
PWA de presupuesto personal, **offline-first**: los datos viven solo en el dispositivo (IndexedDB vía Dexie), sin backend ni telemetría.
Idiomas es/en/fr; moneda COP. IA opcional **BYOK** (Gemini, Claude, OpenAI, Groq) con claves solo en `localStorage`.
Licencias con Lemon Squeezy (activación en vivo) + validación criptográfica offline.

**Stack:** React 19 · TypeScript · Vite 7 · Tailwind 4 · Dexie · Zustand (solo UI y licencia) · React Router · React Hook Form + Zod · Recharts · date-fns · Lucide · Vitest · `vite-plugin-pwa`.

**Mapa del código**
- `src/pages/`: Dashboard, Accounts, Transactions, Budget, Reports, Categories, Templates, AmbiguousReview, Settings.
- `src/components/forms/`: TransactionForm, TransferForm, ReconciliationForm, AccountForm.
- `src/lib/db/`: `index.ts` (esquema Dexie, hoy v9), `backup.ts` (Zod), seeds, migraciones.
- `src/lib/ai/`: `categorizer.ts` (orquestador) y `gateway/` (un adaptador por proveedor). `src/lib/license/`, `src/lib/i18n/`, `src/store/`.
- Pruebas en `src/__tests__/` (espejo de `src/`).

**Despliegue:** `master` = producción en **Vercel** (se despliega al hacer merge; no hay `vercel.json` ni workflows). Hay que confirmar el despliegue en Vercel; las sesiones no pueden verlo.

## 2. Estado real
- **En producción:** 1.4.2. Sin PRs ni issues abiertos.
- **Verificado:** `tsc -b` OK · `eslint` 0 problemas · Vitest 32 archivos / 289 pruebas OK.
- **Corregido recientemente (ya en producción):** transferencias restaban el saldo real de la cuenta destino (1.3.1); borrar una transferencia no revertía el saldo real de la cuenta vinculada (1.3.2); el botón de editar aparecía en transferencias (1.4.2). El dueño ya corrigió a mano los datos afectados.
- **Pendiente real:**
  - README dice "270+ pruebas"; en la rama de handoff está en "280+", aún no en `master`.
  - `package.json` solo tiene Recharts; TanStack Charts está aprobado pero no instalado (ver sección 6).

## 3. Reglas de negocio (no negociables)
- **Saldos atómicos:** el saldo calculado se deriva de la historia de transacciones. Los ajustes son transacciones explícitas (`isAdjustment: true`).
- **La reconciliación no reescribe el pasado:** no se editan ni borran transacciones antiguas para "cuadrar"; se deja evidencia.
- **Dos saldos por cuenta:** `calculatedBalance` (derivado) y `actualBalance?` (saldo real declarado). El **Disponible** del Dashboard = Σ(`actualBalance ?? calculatedBalance`) − reservas.
  Toda escritura que mueva saldo (`TransactionForm`, `TransferForm`, borrado en `Transactions.tsx`, `ReconciliationForm`) debe mantener **ambos** coherentes. De aquí salieron los tres bugs de 1.3.x–1.4.x.
- **Transferencias:** son dos transacciones enlazadas por `transferId` (`transfer-out` / `transfer-in`). Se pueden borrar (revierte ambas cuentas) pero **no editar**.
- **Datos locales:** nada sale del dispositivo. Sin sync remoto, cuentas de usuario ni telemetría sin aprobación.
- **IA:** salida tratada como `unknown`, validada con Zod + grounding contra el catálogo local, con respaldo determinista; nunca escribe directo a la DB.
- **Backups:** validados con Zod; las claves BYOK no se incluyen jamás.

## 4. Comandos
```
npm ci                    # instalar
npm run dev               # servidor de desarrollo
npm run build             # tsc -b && vite build
npm run lint              # eslint .
npm run test:run          # Vitest una vez (npm test = watch)
npm run test:coverage     # cobertura
npm run preview           # servir el build
```
Antes de subir un cambio: `npx tsc -b`, `npm run lint` y `npm run test:run` deben quedar limpios.

## 5. Próximos pasos (propuestos, el dueño decide prioridades)
1. Fusionar el README con el conteo de pruebas actualizado, si se quiere (hoy solo en la rama de handoff).
2. Decidir si se instala **TanStack Charts** y migrar las gráficas de Recharts, o dejar Recharts.
3. Revisar otras rutas que muevan saldo en busca de la misma clase de bug (cuentas con `actualBalance` definido).
4. Confirmar en Vercel que 1.4.2 desplegó bien.
Si el dueño no ha priorizado, **preguntar antes de empezar**; no inventar alcance.

## 6. Forma de trabajar y librerías
La capa común (forma de trabajar, principios de arquitectura, librerías por defecto, UX) **no se duplica aquí**:
- Fuente: https://app.notion.com/p/3f3aa39f8dab81bc80fadd7c6515a087
- En el repo: `AGENTS.md` y `.agents/rules/{working-style,ux-principles}.md` (alineado en la rama `claude/align-common-layer`, pendiente de PR a `master`).

**Excepciones de este proyecto** (detalle en `.agents/rules/architecture.md`):
- Sin backend: la capa de dominio es local (`src/lib`). IA directo desde el navegador con claves BYOK.
- Dexie en lugar de Convex; `date-fns` en lugar de Temporal; sin auth.
- Gráficas: nuevas con `@tanstack/charts` (aún no instalado en `package.json`); Recharts queda para las existentes.
- Flujo de git: ramas nuevas desde `master`, PR y squash merge; `master` despliega a Vercel. Sin push forzado.

## 7. Cómo actualizar este documento
Pedirlo en el chat. Revisar `git log`, PRs/issues y el código; editar solo lo que cambió (estado, pendientes, próximos pasos). **No** acumular historial de versiones aquí. Mantener la copia de Notion (Proyectos > Personal Budget PWA) en sync.
