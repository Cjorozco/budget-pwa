# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado SemVer (`package.json`).

## [Sin publicar]

### Agregado
- Exportación del historial financiero desde Informes en JSON y Markdown, por rango de meses (este mes, 6, 12 o todo), para análisis y proyecciones externas. Se genera en el dispositivo y funciona sin conexión (`2.8.0`).

### Corregido
- Al borrar un movimiento desde la pantalla de Revisión ahora también se revierte el saldo real de la cuenta, así el saldo del Dashboard se actualiza (`2.8.1`).

### Cambiado
- El botón Exportar de Informes se destaca como acción principal de la pantalla (`2.8.1`).
- Los textos de la IA BYOK (`es`, `en`, `fr`) ya no prometen privacidad total: dicen que, con la clave del usuario, el navegador envía directamente al proveedor la descripción, las categorías y ejemplos recientes, sin montos (`2.8.1`).
- Dashboard e Informes obtienen sus cifras de funciones compartidas (`src/lib/reports/monthlyMetrics.ts`), las mismas que usa la exportación. No cambia lo que muestran.
- Documentado que no se activa la protección de rama (requiere plan de pago): el flujo se sostiene por convención. Enmienda al ADR 0007.
- Flujo de ramas unificado: `develop` integra (squash) y `master` publica (merge commit). Ver `docs/adr/0007-flujo-de-ramas.md`. Solo documentación y CI; la versión de la app no cambia (`2.7.1`).
- CI corre en pull requests hacia `develop` y `master` y en push a ambas.
