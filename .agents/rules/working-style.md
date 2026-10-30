# Cómo trabajar en este repo

> **Capa común** a todos los proyectos de José (director y desarrollador principal). Fuente: <https://app.notion.com/p/3f3aa39f8dab81bc80fadd7c6515a087>.
> Aquí solo va lo común. Stack, persistencia, reglas de negocio y **excepciones propias de este proyecto** están en `architecture.md`.

## Cómo trabajar con José

1. Antes de tocar código lee `AGENTS.md` y `.agents/rules/architecture.md` (Cursor: `.cursor/rules/architecture.mdc`).
2. Usa el stack de `package.json`. No migres framework, backend ni librerías salvo que se pida. No copies patrones de otros proyectos.
3. No inventes alcance, tablas, sync ni features "por si acaso". Si algo no está en architecture y no es obvio, pregunta.
4. Sin sobreingeniería (factories, repositorios genéricos, event sourcing, etc.) salvo que el producto ya los use.
5. **Confirma antes de acciones difíciles de revertir o visibles para otros:** cambios de schema, commit, push, merge, borrar ramas, cerrar PRs.
6. Señala riesgos de arquitectura y de costo. No sugieras servicios de pago por defecto.
7. Si cambia arquitectura, dependencias, API o UX, actualiza los docs de este repo.
8. No edites otros repositorios. Esta sesión es de este repo.

## Principios de arquitectura

- **Dominio primero (DDD):** organiza por dominio de negocio, no por tipo de archivo. El código compartido no conoce términos de negocio.
- **Backend fuerte / UI tonta:** las reglas de negocio, los permisos y los cálculos de dinero viven en la capa de dominio. La UI captura input, muestra estado y dispara acciones. Un cálculo sellado en el servidor no se recibe del cliente.
- **Autorización siempre del lado del servidor.** Nunca confíes en el rol que muestra el cliente.
- **Borrado lógico** (`active: false`) para registros con historial; los datos históricos son snapshots inmutables.
- **Decisiones registradas como ADR** en `docs/adr/`.
- **Salidas de IA son `unknown`:** valida con `zod` (`safeParse`), ten fallback determinista y no persistas ni renderices sin validar. Las llamadas a IA y a servicios externos van en el backend, no en el cliente.
- **FinOps:** prefiere lo gratuito o ya instalado.

> Cuando una de estas reglas choca con una razón propia del proyecto, no se cambia: queda como excepción en `architecture.md` (sección "Excepciones del proyecto").

## Código

- TypeScript estricto. Evita `any` en código nuevo.
- Código, variables y comentarios en inglés. Textos de UI en español, directos y sin jerga.
- Reutiliza componentes y patrones del repo antes de añadir una librería.
- Feedback inmediato: loading, `disabled` al enviar, empty, error. Toasts para acciones importantes.
- Acciones destructivas: confirmación explícita (no `window.confirm` si el repo ya tiene diálogo).
- Secretos: nunca commitear API keys. Los secretos de deploy se configuran fuera de git.

## Flujo de ramas

Única fuente de verdad del flujo. Decisión en `docs/adr/0007-flujo-de-ramas.md`.

- `master` es producción; `develop` es integración (preview). Ningún cambio llega a `master` sin pasar antes por `develop`.
- Cada cambio sale en una rama nueva creada desde `develop` y se lleva a `develop` con PR y **squash merge**.
- Para publicar: PR `develop` → `master` con **merge commit** (no squash, para que `develop` no diverja de `master`).
- Hotfix urgente: rama desde `master`, PR a `master` y, el mismo día, PR `master` → `develop`. Es el único caso en que `master` vuelve a `develop`; que `master` tenga de más el commit de merge de cada publicación es normal y no se sincroniza de vuelta.
- Antes de ramificar: `git fetch origin develop` (otras sesiones también publican).
- Nada de push forzado. Push o merge solo cuando se pida.
- Conventional Commits: tipo en inglés y descripción en español (ej. `feat: agrega sección de precios`).
- Las ramas de trabajo se borran al fusionarlas.
- Confirma el flujo de cada repo si cambia.
## Librerías por defecto (solo si el repo no resuelve el problema)

| Propósito | Default |
|---|---|
| Validaciones | zod |
| Fechas | Temporal |
| Tablas | tanstack-table |
| Gráficas | @tanstack/charts (<https://tanstack.com/charts/latest>) |
| Auth | better-auth |
| Animaciones | motion |
| Tipografías | fontsource |
| Estado global | zustand |
| Drag & drop | pragmatic-drag-and-drop |
| Estado en la URL | nuqs |

`package.json` manda: lo ya instalado no se reemplaza.

## Cómo responder

- Código listo para producción, con rutas y comandos exactos.
- Patrón viejo: `⚠️ OUTDATED: [old] → [new]. Reason: [why].`
