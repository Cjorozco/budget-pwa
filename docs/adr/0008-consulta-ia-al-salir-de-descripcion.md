# 0008 — Consulta de IA al salir de la descripción

Aceptada el 2026-11-06.

## Contexto

Una pausa de 500 ms durante la escritura podía consultar al proveedor con una descripción incompleta. Las validaciones guardadas se identifican por descripción normalizada y tipo de movimiento, por lo que un fragmento todavía no recupera la decisión de una descripción completa.

## Decisión

Las sugerencias locales y las validaciones guardadas siguen disponibles mientras se escribe. La comparación automática con IA se programa al salir del campo, con 500 ms para cancelar si el usuario vuelve a editar. Se mantiene el mínimo de tres caracteres y se permite una sola palabra, como «nómina».

Antes de consultar al proveedor se comprueba nuevamente la validación persistida. Las coincidencias entre IA y local y las elecciones del usuario se reutilizan para la misma descripción y tipo. «Regenerar sugerencia» permite solicitar una nueva comparación de forma explícita.

Volver al campo cancela la comparación pendiente. Una respuesta cancelada se descarta antes de mostrarla o guardarla como validada.

## Consecuencias

Las pausas dentro del campo permiten revisar y completar la descripción sin generar consultas automáticas. La comparación comienza al pasar a otro campo. El momento en que el usuario sale del campo determina cuándo el texto está listo para compararse.
