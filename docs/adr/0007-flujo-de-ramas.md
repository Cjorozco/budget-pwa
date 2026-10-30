# 0007 — Flujo de ramas: `develop` integra, `master` publica
- Estado: aceptada
- Fecha: 2026-10-30

## Contexto
El repo describía el flujo de ramas en cuatro archivos con palabras distintas. `AGENTS.md` decía que todo pasa por `develop`, pero `working-style.md` y `architecture.md` decían "ramas desde `master`, PR y squash". En la práctica los PR #52–#59 fueron a `master` y hubo pushes directos a `master`. `develop` existía sin una función clara y CI no corría en pushes a `develop`.

## Decisión
- `master` es producción (Vercel); `develop` es integración y preview. Nada llega a `master` sin pasar por `develop`.
- Cada cambio sale de una rama nueva desde `develop` y entra a `develop` con PR y squash merge.
- Publicar es un PR `develop` → `master` con merge commit (sin squash) para que `develop` no diverja.
- Un hotfix sale de `master`, va por PR a `master` y vuelve a `develop` el mismo día. Es el único caso en que `master` vuelve a `develop`.
- Commits con Conventional Commits: tipo en inglés, descripción en español.
- El flujo vive solo en "Flujo de ramas" de `.agents/rules/working-style.md` (espejo en `.cursor/rules/`). Los demás archivos lo referencian.
- CI corre en PR hacia `develop` y `master` y en push a ambas.

## Consecuencias
- Hay un paso más (`develop` → `master`) por cada publicación, a cambio de una rama de preview estable.
- `master` acumula un commit de merge por publicación que no se devuelve a `develop`; es esperado.
- Sin protección de rama en GitHub, la regla depende de la disciplina. Se recomienda proteger `master` y `develop` (PR obligatorio y CI verde) y confirmar en Vercel que la rama de producción sea `master`; ambos ajustes son del host, no del repo.
- No reemplaza ningún ADR anterior; ninguno trataba el flujo de ramas.

## Enmiendas

### 2026-10-30 — Sin protección de rama en el host
La protección de rama de GitHub no se activará porque requiere plan de pago. El flujo se sostiene por convención, no por bloqueo técnico: las reglas de los agentes, «push o merge solo cuando se pida», sin push forzado y el flujo de dos PR. Esta enmienda sustituye la línea de Consecuencias que daba por pendiente proteger `master` y `develop`. La rama de producción en Vercel es `master`.
