# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado SemVer (`package.json`).

## [Sin publicar]

### Agregado
- Sugerencia de subcategoría a partir de la descripción: usa la misma descripción ya registrada, las palabras clave propias (nuevas, en Categorías) y luego el motor local y la IA. La sugerencia nunca se guarda sin que la apliques, lo que eliges se recuerda al guardar y las reglas se pueden ver y borrar. Nueva tabla `userKeywordRules` en Dexie versión 11, incluida en el respaldo (`2.10.0`).
- Sección "Medianas y tendencias de los últimos 6 meses" al exportar 6 meses, 12 meses o todo, con tendencia y detección de meses atípicos por categoría y subcategoría. En esos períodos reemplaza a los promedios y el JSON pasa a `schemaVersion` 2: `summary` cambia por `medianas_y_tendencias`. "Solo este mes" no cambia (`2.9.0`).
- Exportación del historial financiero desde Informes en JSON y Markdown, por rango de meses (este mes, 6, 12 o todo), para análisis y proyecciones externas. Se genera en el dispositivo y funciona sin conexión (`2.8.0`).

### Corregido
- Al borrar un movimiento desde la pantalla de Revisión ahora también se revierte el saldo real de la cuenta, así el saldo del Dashboard se actualiza (`2.8.1`).

### Cambiado
- La app es gratis completa: se quita el plan PRO y el sistema de licencias de Lemon Squeezy. Sin límites de cuentas, reservas ni plantillas, y la IA (BYOK) y la exportación a CSV quedan abiertas para todos. En Ajustes, "Apoya el proyecto" mantiene el botón "Invítame un café" como aporte voluntario que no desbloquea nada. La app ya no llama a la API de Lemon Squeezy. ADR 0010 reemplaza a 0004 y 0005 (`2.11.0`).
- Los PR hacia `develop` se fusionan con merge commit, igual que los de `develop` a `master`. Enmienda al ADR 0007. Solo documentación.
- En el historial exportado, una categoría con mediana 0 solo se marca como atípica si el monto supera el 25% de la mediana de los totales mensuales, para que las compras pequeñas no marquen meses enteros (`2.9.1`).
- El botón Exportar de Informes se destaca como acción principal de la pantalla (`2.8.1`).
- La guía de usuario (`es`, `en`, `fr`) ya no dice "100% privado" ni "100% seguro": explica que las finanzas se guardan en el navegador y que, con la IA activa, al proveedor elegido le llega lo descrito en la sección 4, nunca los montos. README y reglas de arquitectura alineados (`2.10.1`).
- Los textos de la IA BYOK (`es`, `en`, `fr`) ya no prometen privacidad total: dicen que, con la clave del usuario, el navegador envía directamente al proveedor la descripción, las categorías y ejemplos recientes, sin montos (`2.8.1`).
- Dashboard e Informes obtienen sus cifras de funciones compartidas (`src/lib/reports/monthlyMetrics.ts`), las mismas que usa la exportación. No cambia lo que muestran.
- Documentado que no se activa la protección de rama (requiere plan de pago): el flujo se sostiene por convención. Enmienda al ADR 0007.
- Flujo de ramas unificado: `develop` integra (squash) y `master` publica (merge commit). Ver `docs/adr/0007-flujo-de-ramas.md`. Solo documentación y CI; la versión de la app no cambia (`2.7.1`).
- CI corre en pull requests hacia `develop` y `master` y en push a ambas.
