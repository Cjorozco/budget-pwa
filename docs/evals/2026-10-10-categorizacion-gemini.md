# Evaluación parcial del categorizador IA — Gemini (2026-10-10)

Primera corrida real de `npm run eval:ai` (ver `src/evals/README.md`). **Resultados parciales**: solo dos de los cuatro modelos produjeron datos válidos. No es una métrica absoluta de calidad: son 57 casos y una sola corrida.

## Cómo se obtuvo

- 57 descripciones etiquetadas (`src/evals/categorization/golden.ts`): 49 con categoría esperada y 8 donde lo correcto es "ninguna" (ambiguas, inyecciones y dos casos colombianos sin categoría en el seed).
- Cada modelo se evaluó solo, sin respaldos, con el prompt, el schema y la validación de producción. Tope de 30 s por llamada para medir la latencia sin cortarla.
- Key de la capa gratuita de Gemini, 10 peticiones por minuto.
- Las cifras salen de `eval-results/progress.log` de esa corrida. No hay reporte final: la corrida se cerró a mano durante el tercer modelo.

## Resultados válidos

| Modelo | Acierto exacto | Acierto de raíz | "Ninguna" bien | Latencia p50 | Latencia p95 | Respuestas > 4 s |
|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | 45/49 (92%) | 48/49 (98%) | 7/8 | 1,35 s | 2,3 s | 0/57 |
| `gemini-3.1-flash-lite` | 47/49 (96%) | 48/49 (98%) | 5/8 | 2,3 s | 17,9 s | 18/57 (32%) |

Ninguno de los dos tuvo errores ni respuestas rechazadas.

## Casos no acertados

`gemini-3.5-flash-lite`
- "Compra de libros para la universidad": raíz correcta (Educación), hoja distinta.
- "Tinto y empanada": raíz correcta (Gastos diarios), hoja distinta.
- "Cuota de administración del apartamento": raíz correcta (Vivienda), hoja distinta.
- "Declaración de renta DIAN": sugirió una categoría existente (se esperaba "ninguna" o crear).
- "Taxi to the airport": otra raíz distinta de Transporte.

`gemini-3.1-flash-lite`
- "Compra de libros para la universidad": raíz correcta, hoja distinta.
- "Declaración de renta DIAN", "Pago de Nequi a Juan" y "varios": sugirió una categoría existente (se esperaba "ninguna").
- "Taxi to the airport": otra raíz distinta de Transporte.

## Modelos sin datos válidos

- `gemini-3.6-flash`: la capa gratuita lo limita mucho más que a los Lite. Llegó a procesar 17 casos: 16 terminaron en error de cuota (429) incluso con espera y reintentos (49 esperas registradas) y 1 fue correcto, lo que no permite concluir nada.
- `gemini-3.8-flash`: no llegó a ejecutarse.

Con una key gratuita, los modelos no-Lite prácticamente no sirven como respaldo. Con una key de pago podrían comportarse distinto; esto no se midió.

## Cómo interpretarlo

- La diferencia de acierto entre los dos Lite (45 vs 47) son 2 casos de 49: está dentro del ruido de una corrida.
- `3.5-flash-lite` fue más estable: p95 de 2,3 s y ninguna respuesta por encima del tope de producción de 4 s por intento.
- La lentitud de `3.1-flash-lite` se concentró en una ráfaga continua (casos 13 a 34, hasta ~20 s). Parece una degradación temporal del servicio; hace falta repetir la medición antes de concluir que es estructural.
- `3.5-flash-lite` mostró mejor manejo de "ninguna" (7/8 contra 5/8), también con muestra pequeña.
- Con estos datos, mantener `3.5-flash-lite` como modelo principal está respaldado. El orden de los respaldos no se cambió en este PR.

## Pendiente

- Repetir la corrida en otro momento del día para separar variación del servicio de diferencias entre modelos.
- Evaluar `3.6-flash` y `3.8-flash` con una key de pago, o con `AI_EVAL_RPM` bajo.
- Decidir si la cadena de respaldos para keys gratuitas debe limitarse a los Lite.
