# Evaluación del categorizador IA

Mide qué tan bien categoriza cada modelo con las categorías por defecto de la app, para decidir con datos el modelo principal y la cadena de respaldos. **No forma parte de `npm test`**: llama a la API real.

## Cómo correrla

1. Crea `.env.local` en la raíz (git lo ignora) con una sola línea: `GEMINI_API_KEY=tu-key`. También sirve la variable de entorno del mismo nombre. Sin prefijo `VITE_`, para que Vite no la incluya en el bundle.
2. `npm run eval:ai`

Variables opcionales: `AI_EVAL_MODELS` (lista separada por comas; por defecto la cadena de `src/lib/ai/models.ts`), `AI_EVAL_LIMIT` (primeros N casos), `AI_EVAL_CONCURRENCY` (2), `AI_EVAL_DELAY_MS` (400). En PowerShell: `$env:AI_EVAL_MODELS="gemini-3.5-flash-lite"; npm run eval:ai`.

## Qué mide

Cada modelo se evalúa solo (sin respaldos) sobre `categorization/golden.ts`, con los mismos prompt, schema y validación de producción (`suggestWithAiProvider`):

- **Acierto hoja / raíz:** categoría exacta, o al menos la raíz correcta.
- **"Ninguna" bien:** descripciones sin sentido o inyecciones donde lo correcto es no sugerir.
- **Errores:** timeouts, cuota, respuestas rechazadas por la validación.
- **Latencia p50 / p95 / máx**, medida sin límite de tiempo, y el % de respuestas más lentas que el tope de producción por intento.
- **Confianza** media en aciertos frente a fallos (¿el modelo sabe cuándo duda?).
- Aciertos por tipo de caso: claros, confusables, colombianismos, ambiguos, inyección, otros idiomas, ingresos.

## Privacidad

- La key va solo a Google. No hay telemetría ni se sube nada.
- Los reportes se guardan en `eval-results/` (ignorado por git).

## Límites

- Son ~57 casos: sirven para **comparar modelos entre sí**, no como métrica absoluta de calidad. Una sola corrida puede variar por la carga de la API.
- Solo evalúa Gemini. Agregar otro proveedor implica un cliente con su modelo fijo, como `GeminiProviderClient` con `models`.
- Si cambian las categorías del seed, `src/__tests__/evals/categorization.test.ts` avisa qué casos quedaron desfasados.
