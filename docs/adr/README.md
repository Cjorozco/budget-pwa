# Decisiones de arquitectura (ADR)

Las decisiones de arquitectura de este proyecto se registran aquí, una por archivo: `NNNN-titulo-corto.md`.

Plantilla mínima:

```
# NNNN — Título
- Estado: propuesta | aceptada | reemplazada por NNNN
- Fecha: AAAA-MM-DD

## Contexto
Qué problema hay y qué restricciones.

## Decisión
Qué se decidió.

## Consecuencias
Qué se gana y qué se paga.
```

| ADR | Tema |
|---|---|
| [0001](0001-modelos-ia-centralizados.md) | Modelos de IA centralizados |
| [0002](0002-region-y-moneda.md) | Región y moneda |
| [0003](0003-semilla-localizada-y-enlace-de-region.md) | Semilla localizada y enlace de región |
| [0004](0004-licencias.md) | Licencias: solo Lemon Squeezy, verificado en línea (reemplazada por 0010) |
| [0005](0005-apoyo-pago-unico.md) | Un solo plan: aporte único "invítame un café" (reemplazada por 0010) |
| [0006](0006-tokens-de-diseno-y-movimiento.md) | Tokens de diseño (Figma → `@theme`) y movimiento |
| [0007](0007-flujo-de-ramas.md) | Flujo de ramas: `develop` integra, `master` publica |
| [0008](0008-consulta-ia-al-salir-de-descripcion.md) | Consulta de IA al salir de la descripción |
| [0009](0009-asignacion-de-subcategoria.md) | Asignación de subcategoría desde la descripción |
| [0010](0010-app-gratis-sin-pro.md) | App gratis completa: sin PRO ni licencias |

Las excepciones del proyecto a la capa común están en `.agents/rules/architecture.md`.
