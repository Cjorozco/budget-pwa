# Evaluación del categorizador IA

Mide qué tan bien categoriza cada modelo con las categorías por defecto de la app, para decidir con datos el modelo principal y la cadena de respaldos. **No forma parte de `npm test`**: llama a la API real.

## Cómo correrla

1. Crea `.env.local` en la raíz (git lo ignora) con una sola línea: `GEMINI_API_KEY=tu-key`. También sirve la variable de entorno del mismo nombre. Sin prefijo `VITE_`, para que Vite no la incluya en el bundle.
2. `npm run eval:ai`

Variables opcionales: `AI_EVAL_MODELS` (lista separada por comas; por defecto la cadena de `src/lib/ai/models.ts`), `AI_EVAL_LIMIT` (primeros N casos), `AI_EVAL_CONCURRENCY` (2), `AI_EVAL_RPM` (10 peticiones por minuto). En PowerShell: `$env:AI_EVAL_MODELS="gemini-3.5-flash-lite"; npm run eval:ai`.

## Qué mide

Cada modelo se evalúa solo (sin respaldos) sobre `categorization/golden.ts`, con los mismos prompt, schema y validación de producción (`suggestWithAiProvider`):

- **Acierto hoja / raíz:** categoría exacta, o al menos la raíz correcta.
- **"Ninguna" bien:** descripciones sin sentido o inyecciones donde lo correcto es no sugerir.
- **Errores:** timeouts, cuota, respuestas rechazadas por la validación.
- **Latencia p50 / p95 / máx**, medida sin límite de tiempo, y el % de respuestas más lentas que el tope de producción por intento.
- **Confianza** media en aciertos frente a fallos (¿el modelo sabe cuándo duda?).
- Aciertos por tipo de caso: claros, confusables, colombianismos, ambiguos, inyección, otros idiomas, ingresos.

## Cuota

La capa gratuita de Gemini limita las peticiones por minuto: con ~57 casos × 4 modelos la corrida completa tarda **unos 25 minutos** al ritmo por defecto. Si hay un 429 el runner espera y reintenta (hasta 3 veces). Si aun así quedan errores, el reporte lo advierte: esas cifras no sirven para comparar. Mira `eval-results/progress.log` para ver el avance en vivo.

## Privacidad

- La key va solo a Google. No hay telemetría ni se sube nada.
- Los reportes se guardan en `eval-results/` (ignorado por git).

## Resultados

Primera corrida (parcial, solo los dos modelos Lite con datos válidos): `docs/evals/2026-10-10-categorizacion-gemini.md`.

## Límites

- Son ~57 casos: sirven para **comparar modelos entre sí**, no como métrica absoluta de calidad. Una sola corrida puede variar por la carga de la API.
- Solo evalúa Gemini. Agregar otro proveedor implica un cliente con su modelo fijo, como `GeminiProviderClient` con `models`.
- Si cambian las categorías del seed, `src/__tests__/evals/categorization.test.ts` avisa qué casos quedaron desfasados.
