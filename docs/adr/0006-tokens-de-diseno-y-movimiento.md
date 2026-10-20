# 0006 — Tokens de diseño (Figma → `@theme`) y movimiento
- Estado: aceptada
- Fecha: 2026-10-20

## Contexto
La app no tenía capa de tokens: los colores eran clases sueltas de Tailwind (`bg-slate-50 dark:bg-slate-950`) y el modo oscuro se repetía en cada componente. Para llevar diseños de Figma al código sin valores inventados hacía falta un punto único donde vivan colores, tipografía, tamaños y radios.

El kit de referencia (Finance Dashboard UI Kit, página *Design System*) no usa variables de Figma sino estilos, así que los valores se leyeron de la guía de estilo con el MCP de Figma.

## Decisión
- **Tres capas en `src/index.css`:** (1) paleta cruda en `@theme` (`--color-honeydew`, `--color-caribbean`...), (2) **roles semánticos** en `:root` con su valor oscuro dentro de `@media (prefers-color-scheme: dark)` (`--surface`, `--text`, `--accent`, `--income`...), (3) utilidades vía `@theme inline` (`bg-surface`, `text-income`...). `inline` mantiene el `var()` para que el override oscuro surta efecto.
- **Los componentes usan roles, no la paleta cruda ni hex.** Para añadir un tema nuevo basta cambiar los valores del rol.
- **Modo oscuro por `prefers-color-scheme`**, sin interruptor manual (la app no tiene uno).
- **Dinero con semántica propia:** ingresos en verde y gastos en rojo (`--income`, `--expense`). El kit pinta los gastos en azul; se descarta esa convención porque el color comunica el signo del movimiento.
- **Contraste manda sobre la fidelidad:** el acento `#00D09E` es solo relleno (como texto sobre claro da 1,93:1); el texto sobre él usa `--on-accent`. Los valores de ingreso/gasto se eligieron para superar 4,5:1 sobre las superficies.
- **Tipografía:** Poppins con `@fontsource/poppins` (pesos 300–700), **opt-in** con la clase `font-brand`; la fuente por defecto de la app no cambia. Tamaños `text-body` (15 px) y `text-caption` (13 px), radios `rounded-tile` (22 px) y `rounded-card` (31 px).
- **`cn()` conoce los tokens propios** (`src/lib/utils.ts`). Sin eso `tailwind-merge` interpreta `text-body` como un color y lo descarta junto a `text-income`. Todo token nuevo de tamaño o radio se declara también ahí.
- **Movimiento:** `motion` (`motion/react`). `<MotionConfig reducedMotion="user">` en `App.tsx` es el único lugar donde se decide el respeto a `prefers-reduced-motion`: se conserva el fundido y se quita el desplazamiento.

## Consecuencias
- Los componentes nuevos (`src/components/transactions/`) usan los tokens; los existentes siguen con `slate-*` hasta que se migren de forma incremental. Mientras tanto el cuerpo de la app (`slate-50`/`slate-950`) y `bg-surface` difieren ligeramente.
- A 375 px las columnas del ítem de transacción no caben (el kit es de 430 px): en móvil la categoría va bajo el monto y desde 640 px pasa a su propia columna.
- Cada rol nuevo hay que definirlo en claro, en oscuro y en `@theme inline`.
- Se añaden dos dependencias: `@fontsource/poppins` y `motion`.
