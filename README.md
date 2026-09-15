# Personal Budget PWA 🏦

Gestor de presupuesto personal con filosofía **Senior Financial Thinking**: trazabilidad total, sin correcciones automáticas "mágicas", arquitectura orientada al dominio y modelo **offline-first** (el núcleo funciona 100% sin red).

> **AI-Native Product Engineering Showcase**: Este software fue diseñado, arquitectado y desarrollado bajo un modelo de ingeniería asistida por Inteligencia Artificial. El rol humano actuó como **Product Owner, Arquitecto de Software y Orquestador**, guiando iterativamente al agente de IA para transformar requerimientos de negocio y reglas financieras en código de producción robusto, tipado y mantenible.

---

## 🛠️ Metodología de Desarrollo (AI-Native Engineering)

El desarrollo del proyecto se ejecutó mediante un flujo de **co-creación y orquestación continua con agentes de IA**:

1. **Definición de Dominio & Arquitectura**: Modelado de entidades, invariantes financieras y fronteras de datos con tipado estricto (`TypeScript` + `Zod`) antes de la implementación de interfaces.
2. **"UI Tonta, Dominio Fuerte"**: Separación radical de responsabilidades. La lógica de negocio, cálculos de saldos atómicos, reconciliaciones y persistencia residen en capas desacopladas de la UI, asegurando componentes de vista puramente presentacionales, testeables y predecibles.
3. **Aislamiento e Invariantes de IA (Boundary Protection)**: Las respuestas de modelos de IA (LLMs) se tratan como entradas de red no confiables. Se interceptan y validan estrictamente con esquemas `Zod` (envoltorio HTTP, extracción resiliente de JSON, normalización y límites de longitud) y pasan por una capa de *grounding* (validación contra el catálogo en IndexedDB) antes de tocar la UI o la base de datos.
4. **Iteración Guiada & Estándares Rigurosos**: El orquestador humano define directrices arquitectónicas, valida decisiones técnicas y supervisa la entrega de código asegurando altos estándares de resiliencia y suites de pruebas automatizadas (**Vitest** para lógica pura y persistencia IndexedDB mockeada, junto con pruebas de integración y E2E como **Cypress**).
5. **Resiliencia & FinOps**: Priorización de arquitecturas costo-cero (modelo BYOK para LLMs sin intermediarios, sin dependencias de backend centralizado ni costos fijos de servidor) y tolerancia total a fallos en entornos offline con fallback automático a motores heurísticos locales.

---

## Principios del Proyecto
- **La Reconciliación no corrige el pasado**: No borramos ni editamos transacciones antiguas. Solo dejamos evidencia y fotos (snapshots) del estado financiero.
- **Trazabilidad Total**: Cualquier ajuste al saldo debe ser una transacción explícita (`isAdjustment: true`).
- **Offline-First**: Tus datos de presupuesto viven en el dispositivo (IndexedDB). El núcleo funciona sin red.
- **Saldos Atómicos**: El saldo calculado es la verdad absoluta derivada de la historia de transacciones.
- **Inviolabilidad de Datos ante IA**: Ninguna salida de IA puede escribir directamente en la base de datos ni asumir identificadores inventados; todo pasa por validación Zod, confirmación explícita o grounding contra el catálogo local existente.

## PRO: Gemini (BYOK)

La app **no** trae una API key en el servidor. PRO desbloquea pegar **tu** key:

| Qué | Valor |
|---|---|
| Proveedor (hoy) | Google Gemini — el que funciona sin backend (CORS en el navegador) |
| Dónde crear la key | [Google AI Studio](https://aistudio.google.com/apikey) — tier gratis o de pago |
| Modelo que usa la app | `gemini-flash-latest` (alias Flash; no se elige otro en la UI) |
| Qué **no** sirve aún | ChatGPT Plus, Claude.ai, keys `sk-` de OpenAI o Anthropic (hace falta un servidor). Más adelante se pueden sumar Groq, OpenRouter u otros con CORS. |

La key se guarda en `localStorage` de **este** dispositivo. No entra al backup JSON. Sin red o sin key, se usan solo las reglas locales. Al consultar Gemini se envían la descripción del movimiento y los nombres de tus categorías (no montos ni cuentas).

## Características Clave
- ✅ **Gestión Multi-cuenta**: Bancos, Efectivo y Crédito.
- ✅ **Reconciliación Auditable**: Historial de snapshots con diferencias y notas.
- ✅ **Ajustes Explícitos**: Cierre de brechas mediante transacciones automáticas marcadas.
- ✅ **Reservas por Cuenta**: Crea, edita y elimina montos reservados sin alterar el saldo real.
- ✅ **Categorización Inteligente**: reglas e historial locales; en PRO, Gemini (`gemini-flash-latest`) con **tu** API key de [Google AI Studio](https://aistudio.google.com/apikey).
- ✅ **UI Mobile-First**: Diseñada para una entrada de datos rápida y sin fricción.

## Gestión de Reservas
- Puedes registrar reservas por cuenta para separar dinero destinado a gastos puntuales.
- Las reservas afectan únicamente el **Saldo Disponible**.
- El **Saldo Real en banco/efectivo** no se modifica al crear o editar una reserva.
- Desde el detalle de reservas puedes **editar** (monto y descripción) o **eliminar** una reserva activa.

## Lo que esta App NO hace (Por diseño)
- **No sincroniza con APIs bancarias**: Mantiene el control absoluto en el usuario.
- **No edita reconciliaciones pasadas**: Lo que se cerró, queda como registro histórico para auditoría.
- **No "maquilla" saldos**: Si falta dinero, el sistema pide una nota y crea un movimiento de ajuste.

## Stack Tecnológico
- React 19 + TypeScript (strict) + Vite 7
- TailwindCSS 4 (Premium Mobile-First UI)
- Dexie.js 4 (IndexedDB wrapper, offline-first)
- Zustand (UI state management)
- React Hook Form + Zod (forms & validation)
- Recharts 3 (data visualization)
- Lucide React (iconography)
- vite-plugin-pwa (Progressive Web App)

## Historia de origen

Tenía un Excel para mi presupuesto que siempre se descuadraba porque no metía los gastos a tiempo. Lo convertí en una PWA offline-first que funciona sin internet y se instala en el celular como una app.

## Cómo empezar
1. `npm install`
2. `npm run dev`
3. Abre `localhost:5173` y empieza a tomar el control de tu dinero.
