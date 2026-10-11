# HANDOFF — personal-buget-pwa

Actualizado: 2026-10-11 · Rama: `master` (`eae9456`, merge del PR #50) · Versión: `2.3.0`

Lee primero `AGENTS.md` y `.agents/rules/*`. Las decisiones de diseño están en `docs/adr/` (0001–0004).

## Verificación (2026-10-11, sobre `master`)

- `npm run test:run`: 56 archivos, 553 tests, todos pasan.
- `npm run build`: OK.
- `npx eslint .`: sin problemas (la deuda de lint se limpió en `7046cca`).

## Estado actual

PWA offline-first (React 19, Vite 7, Dexie, Zustand, TanStack Charts). Desde el handoff anterior (v1.3.0) se entregó:

- **Licencias (2.3.0, ADR 0004):** solo una licencia real de la tienda de Lemon Squeezy, activada en línea, concede PRO. Se eliminaron claves maestras, claves "firmadas" y la bandera `budget_is_pro` de `localStorage`. Ciclo de vida: `instance_id`, revalidación cada 24 h, 14 días de gracia sin conexión, desactivación al cerrar sesión. Los IDs salen de `.env` (`VITE_LEMON_*`); si faltan, la activación falla cerrada. Hay una compuerta de publicación en `src/__tests__/release`.
- **Región y moneda (2.0.0, ADR 0002):** países CO, CA, US con una moneda por app (COP, CAD, USD) y centavos exactos. **Breaking:** un backup con cuentas en CAD o USD no abre en versiones anteriores a 2.0.0; los backups COP siguen abriendo.
- **Semilla localizada (ADR 0003)** es/en/fr y enlace de primer arranque.
- **IA:** modelos centralizados (ADR 0001), Gemini con `thinkingLevel`, prompt con criterios por categoría y reglas locales para Canadá, avisos diferenciados (key, cuota, red, timeout), onboarding BYOK con Gemini recomendado, y arnés de evaluación (`npm run eval:ai`).
- **UX:** tour de bienvenida (Movimientos y Cuentas), modo de datos de ejemplo, instalador PWA visible, separador de miles automático en campos de dinero, "Reconciliación" renombrado a "Cuadrar saldo", gráficas migradas a TanStack Charts.
- **Fixes:** transferencias entre cuentas (saldo real del destino y reversión al borrar), sin botón de editar en transferencias.

## Pendiente / a verificar

- **Evaluación de Gemini incompleta** (`docs/evals/2026-10-10-categorizacion-gemini.md`): solo `3.5-flash-lite` y `3.1-flash-lite` dieron datos válidos; `3.6-flash` agotó la cuota gratuita y `3.8-flash` no se ejecutó. Repetir con cuota disponible antes de fijar el modelo por defecto.
- **Probar una licencia real en la app desplegada** (compra de prueba o cupón del 100 %): confirma que los IDs de `.env` (tienda `486315`, producto PRO `1398750`) coinciden con los que devuelve Lemon Squeezy. Si no coinciden nadie puede activar; se corrige cambiando `.env`, sin tocar código.
- **Licencias para la familia:** las claves maestras anteriores (`VIP-GOD-ORZIX` y otras) ya no funcionan. Crear un cupón del 100 % sobre el producto PRO, con límite de activaciones de 3–5 por licencia, y entregar una licencia por persona. GOD no existe como producto en Lemon Squeezy: `VITE_LEMON_GOD_*` está vacío a propósito.
- **Traducciones de la semilla (en/fr):** los 96 nombres de categorías (`src/lib/db/seedNames.ts`) son un borrador y necesitan revisión de un hablante nativo.
- **Razones del motor local** (reglas e historial): siguen en español para todos los idiomas. Tampoco hay botón para traducir categorías ya creadas.
- **IA, fuera de alcance por ahora:** las preguntas "¿es recurrente?" (→ plantilla) y "¿es transferencia propia?" (→ transferencia) de HU-5. Además `3.6-flash` y `3.8-flash` casi no sirven como respaldo dentro del plazo de 8 s ni con key gratuita.
- Chunk principal grande (~1,1 MiB de precache en el build actual); considerar `import()` dinámico si afecta la carga.
- Ramas: `develop` va dos commits atrás de `master` (`469e47c` vs `eae9456`); ponerla al día con `master`. Queda `claude/determined-davinci-36tnp1` en el remoto, con un `docs/HANDOFF.md` antiguo (v1.4.2); se puede borrar al mergear este documento.

## Cómo operar

- **Usuarios nuevos en Canadá:** enviar `https://<la app>/?region=CA&lang=en` (o `lang=fr`) y abrirlo en un navegador sin datos previos. Fija región e idioma antes de sembrar categorías y cuentas; solo se aplica con la base vacía. Si alguien ya abrió la app sin el enlace, en Ajustes restablecer los datos y volver a abrirlo.
- **Evaluación de modelos:** `npm run eval:ai` necesita `GEMINI_API_KEY` en `.env.local` (ignorado por git; sin prefijo `VITE_`). Con la capa gratuita tarda unos 25 minutos y los reportes quedan en `eval-results/` (ignorado). Progreso en `eval-results/progress.log`.
- **`.env` está versionado** y solo debe contener valores públicos: la URL de compra y los IDs de Lemon Squeezy. Nunca claves de API.

## Notas

- Copy de UI en español (traducciones en `src/lib/i18n/translations/`); código y comentarios en inglés.
- `.cursor/rules/*.mdc` es espejo de `.agents/rules/*.md`: al editar uno, actualiza el otro.
- Bumpear semver en `package.json` al shippear.
