# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado SemVer (`package.json`).

## [Sin publicar]

### Cambiado
- Documentado que no se activa la protección de rama (requiere plan de pago): el flujo se sostiene por convención. Enmienda al ADR 0007.
- Flujo de ramas unificado: `develop` integra (squash) y `master` publica (merge commit). Ver `docs/adr/0007-flujo-de-ramas.md`. Solo documentación y CI; la versión de la app no cambia (`2.7.1`).
- CI corre en pull requests hacia `develop` y `master` y en push a ambas.
