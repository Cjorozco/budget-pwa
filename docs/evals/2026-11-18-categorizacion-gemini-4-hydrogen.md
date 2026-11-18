# Evaluación del categorizador IA — Gemini 4 Hydrogen y línea base 3.5-flash-lite (2026-11-18)

Segunda corrida de `npm run eval:ai` (ver `src/evals/README.md`). Objetivo: medir `gemini-4-hydrogen`, que desde `2.13.0` es el primer modelo de la cadena Gemini (`src/lib/ai/models.ts`) sin datos de evaluación, y repetir `gemini-3.5-flash-lite` como línea base frente a la [corrida del 2026-10-10](2026-10-10-categorizacion-gemini.md).

**Conclusión:** Hydrogen no respondió dentro de 30 s en ninguno de los casos probados, así que no sirve dentro del tope de producción de 4 s por intento. `3.5-flash-lite` repite casi idéntico a octubre y sigue siendo la opción respaldada como modelo principal.

## Cómo se obtuvo

- Mismo arnés, prompt, schema y validación de producción (`suggestWithAiProvider` con `GeminiProviderClient`), cada modelo solo y sin respaldos. Tope de 30 s por llamada.
- Key de la capa gratuita de Gemini, 10 peticiones por minuto.
- Tres corridas, en este orden (horas UTC):
  1. **Humo de Hydrogen** (22:05): primeros 3 casos del golden set.
  2. **Control de 3.5-flash-lite** (22:07): los mismos 3 casos, para descartar un problema de key o de red.
  3. **Corrida completa de 3.5-flash-lite** (22:08–22:13): los 57 casos.
- Hydrogen se dejó fuera de la corrida completa: con el resultado del humo solo habría producido 57 timeouts de 30 s.

## Gemini 4 Hydrogen

| Caso | Resultado | Latencia |
|---|---|---|
| "Almuerzo en restaurante" | timeout | 30,02 s |
| "Mercado del mes en el Éxito" | timeout | 30,02 s |
| "Recibo de la luz" | timeout | 30,02 s |

- No se observó ningún 400 ni 429 porque no llegó ninguna respuesta: el temporizador abortó las tres peticiones a los 30 s, sin código HTTP. Por eso **sigue sin verificarse** si la API acepta `thinkingLevel: "low"` (ADR 0001). Con la misma key, uno o dos minutos después, `3.5-flash-lite` respondió los tres casos en menos de 2 s, así que el fallo es propio de Hydrogen.
- No se sabe si Hydrogen responde con un tope mayor o sin `thinkingLevel`: probarlo requiere cambiar el arnés o `models.ts`, fuera del alcance de esta corrida.
- El reporte local muestra latencia 0 ms para Hydrogen porque el resumen excluye los errores de la latencia; la cifra real sale de `eval-results/progress.log`.

### Impacto en producción

El adaptador no recuerda fallos entre peticiones, así que **cada sugerencia de IA con Gemini intenta primero Hydrogen**:

- El intento se corta a los 4 s (`GEMINI_ATTEMPT_TIMEOUT_MS`) y quedan 4 s del plazo total de 8 s para `3.5-flash-lite`.
- Con la latencia medida abajo (p50 1,4 s), la sugerencia tarda unos 5,4 s en lugar de 1,4 s.
- Si `3.5-flash-lite` tarda más de 4 s, el plazo total se agota antes de `3.1-flash-lite` y actúa el motor local.
- La prueba de key en Ajustes ("Probar conexión", `testConnection()` en `src/lib/ai/gateway/geminiAdapter.ts`) usa intentos de 8 s con un plazo total de 20 s, así que probablemente espera unos 8 s en Hydrogen antes de pasar a `3.5-flash-lite`. No se midió: la evaluación solo probó Hydrogen con peticiones de categorización, no con el "Ping" de esa prueba.

## gemini-3.5-flash-lite (57 casos)

| Corrida | Acierto exacto | Acierto de raíz | "Ninguna" bien | Errores | Latencia p50 | Latencia p95 | Respuestas > 4 s |
|---|---|---|---|---|---|---|---|
| 2026-11-18 | 45/49 (92%) | 47/49 (96%) | 7/8 | 1 (`http-5xx`) | 1,41 s | 2,22 s | 0/57 |
| 2026-10-10 | 45/49 (92%) | 48/49 (98%) | 7/8 | 0 | 1,35 s | 2,3 s | 0/57 |

Por tipo de caso: claros 23/24, confusables 9/10, colombianismos 4/6, ambiguos 4/4, inyección 2/2, inglés 2/3, francés 2/2, ingresos 6/6.

### Casos no acertados

- "Compra de libros para la universidad": devolvió solo la raíz (Educación); se esperaba Educación › Libros. Mismo tipo de resultado que en octubre.
- "Cuota de administración del apartamento": raíz correcta (Vivienda), hoja distinta (Mantenimiento en vez de Alquiler o hipoteca). Mismo tipo de resultado que en octubre.
- "Declaración de renta DIAN": sugirió Vivienda › Impuestos a la propiedad; se esperaba "ninguna". Mismo tipo de resultado que en octubre.
- "Taxi to the airport": sugirió Viajes › Transporte; se esperaba Transporte › Privado. Mismo tipo de resultado que en octubre.

La corrida de octubre solo registró el tipo de resultado por caso, no la categoría devuelta, así que no se puede confirmar que la sugerencia fuera la misma.
- "Arreglo de la fuga del baño": error `http-5xx` del servidor de Google (en octubre fue correcto).

"Tinto y empanada", que en octubre acertó solo la raíz, esta vez acertó la hoja.

### Cómo interpretarlo

- **El error `http-5xx` es del servicio, no del modelo ni de la cuota** (no fue 429). Afecta 1 de 57 casos. El reporte automático advierte que con errores las cifras no son comparables; aquí la única diferencia con octubre en acierto de raíz (47 contra 48) es justo ese caso, así que la comparación sigue siendo útil con esa salvedad.
- **Entre corridas, el modelo es estable:** los mismos cuatro casos fallan con el mismo tipo de resultado (libros, administración, DIAN y taxi), la latencia es casi igual y ninguna respuesta supera el tope de producción. El acierto exacto igual (45/49) no lo prueba por sí solo: sale de un caso ganado ("Tinto y empanada") y uno perdido por el error `http-5xx` ("Arreglo de la fuga del baño"). Que fallen los mismos casos en dos corridas sugiere que no es ruido, aunque dos corridas no bastan para asegurarlo.
- La confianza media es 0,98 en aciertos y 0,95 en raíz equivocada o solo raíz (el arnés no incluye ahí los falsos positivos; el de "Declaración de renta DIAN" tuvo 0,85): el modelo casi no distingue cuándo duda.

## Recomendación (no aplicada en este cambio)

- Quitar `gemini-4-hydrogen` del primer lugar de la cadena en `src/lib/ai/models.ts` (comentarlo como Argon y Carbon, o moverlo al final) y volver a `gemini-3.5-flash-lite` como modelo principal. El cambio también toca:
  - ADR 0001.
  - El texto de `modelDescription`, que nombra a Hydrogen en `src/lib/ai/gateway/config.ts` y en `src/lib/i18n/translations/{es,en,fr}.ts`.
  - Los tests que exigen Hydrogen primero: `src/__tests__/lib/ai/models.test.ts` y `src/__tests__/lib/ai/geminiAdapter.test.ts`.
  - CHANGELOG y versión: revierte un cambio publicado en `2.13.0`.
- Antes de reactivarlo, verificar Hydrogen contra la API con un tope mayor y con otros `thinkingLevel` para saber si es lento o si no responde.

## Pendiente

- `gemini-3.6-flash` y `gemini-3.8-flash` siguen sin datos: la capa gratuita los limita (429). Requieren una key de pago o un `AI_EVAL_RPM` muy bajo.
- `gemini-3.1-flash-lite` no se repitió: sigue sin saberse si su p95 de 17,9 s de octubre fue una degradación temporal.
- El resumen del arnés excluye los errores de la latencia, lo que oculta los timeouts (muestra 0 ms). Conviene que el reporte muestre la latencia de los errores o los marque aparte.
