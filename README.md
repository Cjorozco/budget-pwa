# Personal Budget PWA 🏦

Gestor de presupuesto personal con filosofía **Senior Financial Thinking**: trazabilidad total, sin correcciones automáticas "mágicas", arquitectura orientada al dominio y modelo **offline-first** (el núcleo funciona 100% sin red).

> **AI-Native Product Engineering Showcase**: Este software fue diseñado, arquitectado y desarrollado bajo un modelo de ingeniería asistida por Inteligencia Artificial. El rol humano actuó como **Product Owner, Arquitecto de Software y Orquestador**, guiando iterativamente al agente de IA para transformar requerimientos de negocio y reglas financieras en código de producción robusto, tipado y mantenible.

---

## 🛠️ Metodología de Desarrollo (AI-Native Engineering)

El desarrollo del proyecto se ejecutó mediante un flujo de **co-creación y orquestación continua con agentes de IA**:

1. **Definición de Dominio & Arquitectura**: Modelado de entidades, invariantes financieras y fronteras de datos con tipado estricto (`TypeScript` + `Zod`) antes de la implementación de interfaces.
2. **"UI Tonta, Dominio Fuerte"**: Separación radical de responsabilidades. La lógica de negocio, cálculos de saldos atómicos, reconciliaciones y persistencia residen en capas desacopladas de la UI, asegurando componentes de vista puramente presentacionales, testeables y predecibles.
3. **Aislamiento e Invariantes de IA (Boundary Protection)**: Las respuestas de modelos de IA (LLMs) se tratan como entradas de red no confiables. Se interceptan y validan estrictamente con esquemas `Zod` (envoltorio HTTP, extracción resiliente de JSON, normalización y límites de longitud) y pasan por una capa de *grounding* (validación contra el catálogo en IndexedDB) antes de tocar la UI o la base de datos.
4. **Iteración Guiada & Estándares Rigurosos**: El orquestador humano define directrices arquitectónicas, valida decisiones técnicas y supervisa la entrega de código asegurando altos estándares de resiliencia y suites de pruebas automatizadas (**Vitest** para lógica pura y persistencia IndexedDB mockeada con más de 270 tests automatizados).
5. **Resiliencia & FinOps**: Priorización de arquitecturas costo-cero (modelo BYOK para LLMs sin intermediarios, sin dependencias de backend centralizado ni costos fijos de servidor) y tolerancia total a fallos en entornos offline con fallback automático a motores heurísticos locales.

---

## 💎 Principios del Proyecto
- **La Reconciliación no corrige el pasado**: No borramos ni editamos transacciones antiguas. Solo dejamos evidencia y fotos (*snapshots*) del estado financiero.
- **Trazabilidad Total**: Cualquier ajuste al saldo debe ser una transacción explícita (`isAdjustment: true`).
- **Offline-First**: Tus datos de presupuesto viven en el dispositivo (`IndexedDB`). El núcleo funciona 100% sin red.
- **Saldos Atómicos Derivados**: El saldo calculado es la verdad absoluta derivada de la historia de transacciones.
- **Inviolabilidad de Datos ante IA**: Ninguna salida de IA puede escribir directamente en la base de datos ni asumir identificadores inventados; todo pasa por validación Zod, confirmación explícita o grounding contra el catálogo local existente.

---

## 🤖 PRO & GOD: Gateway de IA Multi-Proveedor (BYOK)

La app **no** requiere ni incluye API keys centralizadas en el servidor. El plan PRO desbloquea ingresar **tu propia API key (Bring Your Own Key)** para máxima privacidad y costo cero de infraestructura:

| Proveedor | Modelos Soportados | Endpoint / CORS |
|---|---|---|
| **Google Gemini** | `gemini-flash-latest`, `gemini-1.5-pro` | Directo en navegador vía Google AI Studio |
| **Anthropic Claude** | `claude-3-5-haiku-latest`, `claude-3-5-sonnet-latest` | Directo en navegador con rol de Asesor Financiero |
| **OpenAI** | `gpt-4o-mini`, `gpt-4o` | Directo en navegador vía OpenAI API |
| **Groq** | `llama-3.3-70b-versatile` | Inferencia de ultra-baja latencia |

*Las API keys se almacenan exclusivamente en el `localStorage` del dispositivo y **nunca** se incluyen en los backups JSON ni viajan a servidores de terceros.*

---

## 💳 Sistema de Licenciamiento (Lemon Squeezy)

La aplicación integra monetización y activación de licencias sin necesidad de backend propio:
- **Activación en vivo:** Conexión con `api.lemonsqueezy.com` para activar claves y calcular dinámicamente vigencias mensuales, anuales o perpetuas.
- **Validación Criptográfica Local:** Validador de checksums integrado (`licenseValidator.ts`) con tolerancia y soporte offline.
- **Planes:**
  - **Free (Local Core):** Categorizador por reglas locales, presupuesto, cuentas, reportes y reconciliación ilimitada sin costo.
  - **PRO:** Activación de IA Multi-proveedor (BYOK) y soporte extendido.
  - **GOD Tier:** Experiencia integral con asesor financiero inteligente y herramientas avanzadas.

---

## ✨ Características Clave
- ✅ **Gestión Multi-cuenta**: Bancos, Efectivo y Tarjetas de Crédito.
- ✅ **Reconciliación Auditable**: Historial de snapshots con diferencias calculadas y notas de auditoría.
- ✅ **Ajustes Explícitos**: Cierre de brechas mediante transacciones automáticas marcadas.
- ✅ **Reservas por Cuenta**: Crea, edita y elimina montos apartados sin alterar el saldo real bancario.
- ✅ **Reportes Avanzados**: Desglose jerárquico por categorías padre y subcategorías, comparativa de ingresos y cumplimiento del presupuesto fijo.
- ✅ **Categorización Inteligente**: Motor local instantáneo con reglas colombianas (Rappi, D1, Éxito, PSE, etc.) + IA Multi-proveedor (Gemini, Claude, OpenAI, Groq).
- ✅ **UI Mobile-First Accesible**: Diseñada para entrada rápida con touch bar inferior, modales seguros y dark mode.

---

## 📊 Métricas del Dashboard y Conceptos Financieros

La app separa intencionalmente la **liquidez patrimonial acumulada** del **flujo de caja mensual**:

1. **Total Disponible (Saldo Acumulado Real):**
   - Mide el dinero líquido real que posees hoy en todas tus cuentas bancarias y efectivo, deduciendo las reservas activas:
     $$\text{Total disponible} = \text{Saldo en todas las cuentas} - \text{Reservas activas}$$

2. **Ingresos (mes) y Gastos (mes) (Flujo del Período):**
   - Miden exclusivamente las entradas y salidas registradas entre el primer y último día del mes en curso.
   - El indicador de **Flujo neto mensual** ($\text{Ingresos} - \text{Gastos}$) aclara si durante el mes puntual hubo superávit o déficit.

3. **Transferencias entre Cuentas:**
   - Mover dinero entre tus propias cuentas (ej. *Bancolombia ➔ Lulo*) **no** se considera ingreso ni gasto; por diseño se excluyen de las tarjetas mensuales para evitar duplicidades.

---

## 🚫 Lo que esta App NO hace (Por diseño)
- **No sincroniza con APIs bancarias**: Mantiene la privacidad y el control absoluto en el usuario.
- **No edita reconciliaciones pasadas**: Lo que se cerró, queda como registro histórico para auditoría.
- **No "maquilla" saldos**: Si falta dinero, el sistema pide una nota y crea un movimiento de ajuste explícito.

---

## 🛠️ Stack Tecnológico
- **React 19** + **TypeScript** (Strict) + **Vite 7**
- **Tailwind CSS 4** (Mobile-First UI & Utilities)
- **Dexie.js 4** (IndexedDB wrapper reactivo con `dexie-react-hooks`)
- **Zustand** (Estado transitorio de UI y licencias)
- **React Hook Form** + **Zod** (Formularios, validación de schemas y contratos de IA)
- **Recharts 3** (Visualización interactiva)
- **Lucide React** (Iconografía)
- **vite-plugin-pwa** (Progressive Web App con Service Worker de auto-actualización)
- **Vitest** (270+ pruebas unitarias y de integración)

---

## 🚀 Cómo empezar

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar en modo desarrollo
npm run dev

# 3. Ejecutar pruebas automatizadas
npm run test:run

# 4. Compilar para producción
npm run build
```
