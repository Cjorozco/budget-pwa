# Reglas de Arquitectura, Diseño y Mobile-First

## Stack y Convenciones del Proyecto

- **React 19 + TypeScript** (con foco estricto en type-safety)
- **Vite 7**
- **Tailwind CSS 4** para una UI mobile-first basada en utilidades
- **Dexie.js (IndexedDB)** + `dexie-react-hooks` para persistencia y reactividad offline-first
- **Zustand** para estado de UI transitorio (toasts, flags, confirm dialogs)
- **React Router** para navegación
- **React Hook Form + Zod** para validación consistente en formularios y fronteras de datos
- **Recharts** para visualizaciones (optimizadas para móvil)

### Convenciones Clave de Dominio:
- Los cálculos “de verdad” deben derivarse de la historia de transacciones (no de “ajustes” implícitos).
- Los cambios que alteran el saldo deben ser trazables como transacciones explícitas (`isAdjustment: true`).
- Evitar lógica acoplada a la UI: separar “datos/DB” y “render” cuando sea práctico.

---

## Principios de Diseño del Negocio

Estos son los principios fundamentales que deben mantenerse en todo momento:

- **La Reconciliación no corrige el pasado**: no borramos ni editamos transacciones antiguas; solo dejamos evidencia y snapshots del estado financiero.
- **Trazabilidad Total**: cualquier ajuste al saldo debe ser una transacción explícita (`isAdjustment: true`).
- **Offline-First**: los datos nunca salen del dispositivo; persistimos robustamente en IndexedDB.
- **Saldos Atómicos**: el saldo calculado es la verdad absoluta derivada de la historia de transacciones.
- **Gemini BYOK (PRO)**: la única llamada de red opcional es a `generativelanguage.googleapis.com` con la API key que el usuario ingresa (Google AI Studio, modelo `gemini-flash-latest`). No hay proxy ni key en el build. El orquestador `suggestWithLlm` es el punto de extensión.

---

## Mobile-First como Regla No Negociable

La app está diseñada para usarse principalmente en celular:

- La navegación principal es una **barra inferior fija** (touch UI) y la jerarquía de pantallas prioriza lectura y entrada rápida.
- El layout base debe funcionar fluidamente en pantallas pequeñas sin depender de `md:`/`lg:` para “verse bien”.
- Breakpoints (`sm:`, `md:`, `lg:`) se usan exclusivamente como **mejora progresiva** (densidad, distribución), nunca como requisito para que la pantalla sea usable.
- Evitar patrones “desktop-first” en móvil:
  - Tablas horizontales sin fallback responsivo.
  - Controles que dependan únicamente de estados hover.
  - Anchos fijos que desborden el viewport.
- Si una vista necesita overflow (cards/side scrollers), debe resolverse con scroll horizontal controlado (`overflow-x-auto`) sin bloquear la interacción vertical.

---

## Contexto de Marca Personal

Esta app es una **vitrina pública** de capacidades como desarrollador **Senior Frontend**:

- Cada decisión técnica debe justificarse: por qué existe, qué problema resuelve y cómo impacta en UX, mantenibilidad o confiabilidad.
- El código debe ser limpio, estructurado y fácil de auditar.
- Nomenclatura clara, flujos consistentes, validaciones explícitas y manejo de errores predecible.
- La filosofía offline-first/auditable debe reflejarse tanto en la arquitectura como en el estilo visual.

---

## Buenas Prácticas Modernas

- **Accesibilidad (a11y)**: foco visible, labels adecuados, roles/atributos de diálogos cuando aplique, y comportamiento correcto de teclado.
- **Performance**: memoizar valores derivados cuando aporte valor real; evitar trabajo repetido innecesario en renders.
- **PWA moderna**:
  - Experiencia base (assets estáticos) funciona offline vía Service Worker (`registerType: 'autoUpdate'`).
  - `manifest.webmanifest` consistente con la UX (tema, íconos, display standalone).
  - Runtime caching: `NetworkOnly` para `generativelanguage.googleapis.com` (Gemini BYOK).
- **Offline UX**: toda acción de persistencia debe funcionar sin conexión a red; mostrar feedback claro y no invasivo.
- **Seguridad y Privacidad**: sin telemetría ni tracking; validación con Zod en fronteras de persistencia y backups.
- **Calidad de Código**: suite de pruebas unitarias/integración con Vitest para lógica pura, validaciones y acceso a DB.
