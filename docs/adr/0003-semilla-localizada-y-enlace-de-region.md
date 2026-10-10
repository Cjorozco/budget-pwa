# 0003 — Semilla localizada y enlace de región
- Estado: aceptada
- Fecha: 2026-10-10

## Contexto
Con la región y la moneda resueltas (ADR 0002), un usuario canadiense seguía viendo en español las categorías, las plantillas y el ajuste de cuadre de saldo que se crean en el primer arranque. Además, la región solo se deduce sola con un navegador `en-CA`/`fr-CA`: muchos canadienses usan `en-US`, y arrancarían en Colombia/COP sin poder arreglarlo después, porque la semilla ya se hizo.

## Decisión
- **Categorías en el idioma del primer arranque.** Las 121 categorías por defecto (96 nombres) se crean en español, inglés o francés (`src/lib/db/seedNames.ts`; traducciones de primer borrador, pendientes de revisión por un hablante nativo). Los nombres son datos del usuario: cambiar el idioma de la interfaz después no los reescribe.
- **Clave canónica `seedKey`.** Cada categoría sembrada guarda su ruta canónica en español (`"Gastos diarios › Supermercado"`). Las reglas locales, los criterios de la IA y el set de evaluación siguen nombrando las categorías en español; la búsqueda (`findCategoryByPath`, `findOrCreateCategory`) mira primero la clave y luego el nombre. Es un campo opcional: no cambia el esquema de Dexie ni el de backup (que ya lo conserva), y quien ya tiene datos no cambia nada.
- **Categorías que crean las reglas** (por ejemplo "Café" o "Impuestos") también se crean en el idioma del usuario, con su clave, bajo la raíz traducida existente; así no se duplican raíces ni se vuelve a proponer crearlas. Las propuestas de la IA se crean tal como las dio el modelo, sin clave.
- **Criterios de la IA:** se buscan por la ruta canónica y sus referencias a otras categorías se reescriben con los nombres que el usuario tiene, para que el prompt nunca apunte a una categoría que no está en su catálogo. Con categorías en español el prompt no cambia.
- **Plantillas rápidas** por idioma y por moneda: 50.000 pesos no es una compra de supermercado en dólares (CAD/USD: 100, 15 y 6).
- **Categoría de ajuste de cuadre de saldo:** se busca por clave (o por el nombre antiguo), de modo que sea la misma al cambiar de idioma; la descripción de los ajustes sale en el idioma de la interfaz.
- **Enlace de primer arranque** `?region=CA&lang=en` (`applyFirstRunRegion`): fija región e idioma antes de sembrar, y quita sus parámetros de la barra de direcciones. **Solo se aplica con la base vacía**, por lo que nunca reetiqueta datos reales; un enlace explícito gana sobre una región guardada antes. Valores inválidos se ignoran.

## Cómo probar con usuarios en Canadá
Enviar `https://<la app>/?region=CA&lang=en` (o `lang=fr`). Si alguien ya abrió la app sin el enlace, la semilla ya se hizo: en Ajustes, restablecer los datos y volver a abrir el enlace.

## Consecuencias
- Cualquier categoría nueva por defecto debe añadirse a `SEED_NAME_TRANSLATIONS` (un test lo exige).
- Las razones del motor local (reglas, historial) siguen en español para todos los idiomas.
- No hay botón para traducir categorías ya creadas: cambiar de idioma no las toca.
