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
| [0004](0004-licencias.md) | Licencias: solo Lemon Squeezy, verificado en línea |
| [0005](0005-apoyo-pago-unico.md) | Un solo plan: aporte único "invítame un café" |

Las excepciones del proyecto a la capa común están en `.agents/rules/architecture.md`.
