# personal-buget-pwa — Arquitectura

> Este repo es **offline-first (Dexie / IndexedDB)**. No uses Convex, Next.js ni reglas de Ecosistemas Platform.
> Aquí va **solo lo propio de este producto**. La forma de trabajar, los principios de arquitectura, las librerías por defecto y la UX comunes están en `working-style.md` y `ux-principles.md` (fuente: <https://app.notion.com/p/3f3aa39f8dab81bc80fadd7c6515a087>).

## Stack del proyecto

- **React 19 + TypeScript** (strict)
- **Vite 7**
- **Tailwind CSS 4** (mobile-first, ver `ux-principles.md`)
- **Dexie.js (IndexedDB)** + `dexie-react-hooks` para persistencia y reactividad offline-first
- **Zustand** para estado de UI transitorio (toasts, flags, confirm dialogs) y estado de licencia
- **React Router** para navegación
- **React Hook Form + Zod** para formularios, contratos de IA y backups
- **TanStack Charts** (`@tanstack/charts`) para las gráficas
- **date-fns**, **Lucide**, **vite-plugin-pwa**
- **Vitest** para pruebas unitarias y de integración

## Excepciones del proyecto a la capa común

Estas reglas comunes **no se aplican tal cual** aquí, por razones propias del producto. No se cambian sin pedirlo.

| Regla común | En este proyecto | Por qué |
|---|---|---|
| Backend fuerte, autorización en servidor | No hay backend. El "backend" es la capa de dominio local (`src/lib`). Sin autorización de usuarios. | Offline-first y soberanía de datos |
| Llamadas a IA y servicios externos en el backend | Directo desde el navegador con claves BYOK en `localStorage` | Sin servidor propio; costo cero |
| Fechas: Temporal | `date-fns` | Ya instalado |
| Auth: better-auth | No aplica | Sin cuentas ni backend |
| Persistencia del repo común (Convex) | Dexie / IndexedDB | Offline-first |
| Borrado lógico (`active: false`) | Solo donde ya existe; el resto de la historia es inmutable por la regla de reconciliación | No reescribir el pasado |
| Flujo `develop` → `master` | Ramas nuevas desde `master`, PR y squash merge (ver `working-style.md`) | `master` despliega a producción en Vercel |

## Convenciones clave de dominio

- Los cálculos "de verdad" se derivan de la historia de transacciones (no de "ajustes" implícitos).
- Los cambios que alteran el saldo son trazables como transacciones explícitas (`isAdjustment: true`).
- Separa "datos/DB" y "render" cuando sea práctico.

## Principios de diseño del negocio

No negociables:

- **La reconciliación no corrige el pasado:** no borramos ni editamos transacciones antiguas; solo dejamos evidencia y snapshots del estado financiero.
- **Trazabilidad total:** cualquier ajuste al saldo es una transacción explícita (`isAdjustment: true`).
- **Offline-first:** los datos nunca salen del dispositivo; se persisten en IndexedDB.
- **Saldos atómicos:** el saldo calculado es la verdad derivada de la historia de transacciones.
- **IA multi-proveedor BYOK (PRO/GOD):** Google Gemini, Anthropic Claude, OpenAI y Groq directo desde el navegador con claves del usuario. Sin proxy ni backend. Puntos de extensión: `src/lib/ai/gateway/` y el orquestador `categorizer.ts`. Los IDs de modelo y su orden de respaldo viven solo en `src/lib/ai/models.ts` (ver `docs/adr/0001-modelos-ia-centralizados.md`).
- **Licenciamiento Lemon Squeezy:** activación contra `api.lemonsqueezy.com` y validación criptográfica local con fallback offline.

## PWA, Dexie y estado

- Persistencia: IndexedDB vía Dexie. `useLiveQuery` en componentes; nunca async crudo en render.
- Escrituras multi-tabla: `db.transaction()`. IDs: `uuid`. Índices en campos de `.where()`.
- Totales: derivar de la historia; no guardar saldos stale.
- Zustand solo para UI (toasts, modales, flags) y estado transitorio de licencias. No duplicar la DB en Zustand.
- Formularios: React Hook Form + Zod.
- Service Worker: `vite-plugin-pwa`, `registerType: 'autoUpdate'`. El core funciona sin red.
- `manifest.webmanifest` consistente con la UX (tema, íconos, display standalone).
- Runtime caching: `NetworkOnly` para APIs de IA (`generativelanguage.googleapis.com`, `api.anthropic.com`, `api.openai.com`, `api.groq.com`) y Lemon Squeezy.
- Offline UX: toda acción de persistencia funciona sin red, con feedback claro y no invasivo.
- Seguridad y privacidad: sin telemetría ni tracking; validación con Zod en fronteras de persistencia y backups.
- BYOK keys: NUNCA en `VITE_*`, Dexie ni backups. Solo `localStorage`.
- UI: español por defecto (también en/fr). Región y moneda en `src/lib/region/` (Colombia/COP por defecto; Canadá/CAD y Estados Unidos/USD): todo monto se muestra con `formatCurrency()` y se escribe con `MoneyInput`, nunca con formato fijo. Los saldos se redondean a centavos en la frontera de persistencia (hook de Dexie en `src/lib/db/index.ts`). Una sola moneda por app. Ver `docs/adr/0002-region-y-moneda.md`. Iconos Lucide. Confirmaciones con `ConfirmDialog` del UI store.
- LLM: no escribe a IndexedDB ni a UI sin Zod + grounding.

## Contexto de marca personal

Esta app es una **vitrina pública** de capacidades como desarrollador Senior Frontend:

- Cada decisión técnica se justifica: por qué existe, qué problema resuelve y cómo impacta en UX, mantenibilidad o confiabilidad.
- Código limpio, estructurado y fácil de auditar. Nomenclatura clara, validaciones explícitas, manejo de errores predecible.
- La filosofía offline-first/auditable se refleja en la arquitectura y en el estilo visual.

## Versión de la app

Al publicar cambios con significado (no typos/comentarios), bumpear `package.json` `"version"`:

- **PATCH:** bugs, copy, tests, refactors sin cambio de comportamiento
- **MINOR:** features, pantallas, PWA/offline, reglas del categorizador, nuevos proveedores
- **MAJOR:** Dexie schema que pierde datos, backup incompatible, rutas rotas, lanzamiento de versión mayor

Dexie `version(n)` ≠ semver de la app. Si la UI/manifest muestran versión, alinear con `package.json`.
Mencionar: `📦 VERSION: x.y.z → x.y.w (PATCH|MINOR|MAJOR — razón)`.

## Fuera de alcance (sin aprobación)

- Sync remoto / cuentas / backend propio
- Telemetría invasiva
- Reemplazar Dexie por Convex u otra DB
