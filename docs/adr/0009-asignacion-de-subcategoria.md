# 0009 — Asignación de subcategoría desde la descripción

Aceptada el 2026-11-09. Enmienda al ADR 0008.

## Contexto

El formulario llenaba la categoría solo cuando la confianza era alta, y la coincidencia entre IA y motor local se guardaba como validada sin intervención del usuario. Un cambio manual no enseñaba nada, y una categoría con subcategorías podía quedar asignada sin aparecer en el selector.

## Decisión

La sugerencia sigue este orden: descripción ya confirmada, movimiento más reciente con la misma descripción, palabras clave del usuario, motor local e IA. La IA se omite si la misma descripción o una palabra clave ya decidieron, salvo con «Regenerar sugerencia».

La sugerencia nunca llena la categoría. El usuario la aplica o elige otra, y la relación se aprende al guardar el movimiento, en la misma transacción de Dexie. Editar un movimiento y cambiar su categoría también enseña. La coincidencia entre IA y motor local deja de guardarse sola.

Las palabras clave viven en la tabla `userKeywordRules` (Dexie versión 11), coinciden por palabra completa y gana la más larga. Se incluyen en el respaldo. Una categoría con subcategorías no se propone: se muestran sus subcategorías para elegir.

No se crea una categoría «Sin clasificar», porque la categoría es obligatoria y un grupo nuevo alteraría los informes. El historial exportado sigue sin descripciones.

## Consecuencias

Cada movimiento repetido cuesta un toque más, a cambio de que nada se clasifique sin confirmación. Las transacciones existentes no cambian. Las validaciones automáticas anteriores no se distinguen de las confirmadas: siguen siendo solo sugerencias y se pueden borrar en Categorías.
