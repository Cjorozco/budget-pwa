# 0002 — Región y moneda
- Estado: aceptada
- Fecha: 2026-10-10

## Contexto
La app asumía Colombia en todas partes: moneda `COP` fija en tipos, esquemas y backup, formato `es-CO` fijo en `formatCurrency()` y en el campo de monto, y montos mínimos de 1 peso. Se necesita usarla también en Canadá (CAD) y con USD.

## Decisión
- **Región = país** (`CO`, `CA`, `US`), y cada país tiene **una sola moneda** (`COP`, `CAD`, `USD`). Vive en `src/lib/region/`. Toda la app usa una moneda: los saldos se suman, y mezclar monedas daría totales falsos. Sin tipo de cambio.
- **Dónde se guarda:** en `localStorage` (`budget_region`), para que `formatCurrency()` funcione de forma síncrona desde el primer render, y se refleja en `appConfig` (`defaultCurrency` y `country`) para que viaje en los backups.
- **Por defecto Colombia/COP**, igual que siempre: quien actualiza no cambia. En el primer arranque (base vacía) solo se deduce Canadá de un navegador `en-CA`/`fr-CA` (y el idioma de la interfaz si no había uno guardado). Estados Unidos nunca se deduce.
- **Formato numérico:** Colombia siempre `es-CO` (el formato histórico, sin importar el idioma de la interfaz); Canadá sigue el idioma (`en-CA` o `fr-CA`); EE. UU. `en-US`. Los separadores salen de `Intl`, no están fijos. COP sin decimales; CAD y USD con centavos.
- **Centavos exactos:** los saldos se redondean a centavos en un hook de Dexie sobre `accounts` (`src/lib/db/index.ts`), en la frontera de persistencia, para que ningún sitio de escritura pueda olvidarlo. Con pesos enteros no cambia nada. El cuadre de saldo trata una diferencia de 1 centavo como diferencia.
- **Cambiar de región** (Ajustes) reetiqueta la moneda de las cuentas y `appConfig` tras una confirmación; **no convierte montos**. El conteo de cuentas se lee en el momento del clic.
- **Backup:** acepta `COP`, `CAD` y `USD`, con una sola moneda por archivo; al importar, la región pasa a ser la del respaldo. La `version` del backup sigue en 1.

## Consecuencias
- Es un cambio **MAJOR (2.0.0)**: un backup en CAD o USD no se abre en versiones anteriores (su esquema solo aceptaba `COP`). Los backups COP existentes se siguen abriendo.
- Sin tipo de cambio, quien tenga dinero en dos monedas no puede reflejarlo en una misma app.
- Cambiar de región con datos reales reetiqueta sin convertir; por eso la confirmación recomienda un respaldo.
- **IA y reglas por región:** el prompt del categorizador recibe el país (Colombia, Canadá, EE. UU.) y escribe la `reason` en el idioma de la interfaz; con Colombia y español es exactamente el prompt de siempre (un test lo fija). En Canadá se añade una nota de que las descripciones pueden venir en español, inglés o francés.
- **Reglas locales de Canadá** (`src/lib/ai/categoryRulesCA.ts`): comercios canadienses y palabras en inglés y francés, solo cuando la región es Canadá y evaluadas antes que las reglas base. Coinciden por palabra completa (`wholeWord`), para que "bell" o "cra" no disparen dentro de otras palabras, y apuntan a las categorías por defecto del seed.
- Pendiente: las categorías y la cuenta inicial siguen sembrándose en español, y las razones del motor local (reglas, historial) siguen en español para todos los idiomas; un usuario canadiense en inglés las ve en español.
