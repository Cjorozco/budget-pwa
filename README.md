# Personal Budget PWA 🏦

Gestor de presupuesto personal con filosofía **Senior Financial Thinking**: trazabilidad total, sin correcciones automáticas "mágicas" y 100% offline-first.

## Principios del Proyecto
- **La Reconciliación no corrige el pasado**: No borramos ni editamos transacciones antiguas. Solo dejamos evidencia y fotos (snapshots) del estado financiero.
- **Trazabilidad Total**: Cualquier ajuste al saldo debe ser una transacción explícita (`isAdjustment: true`).
- **Offline-First**: Tus datos nunca salen de tu dispositivo. Usamos IndexedDB para persistencia local robusta.
- **Saldos Atómicos**: El saldo calculado es la verdad absoluta derivada de la historia de transacciones.

## Características Clave
- ✅ **Gestión Multi-cuenta**: Bancos, Efectivo y Crédito.
- ✅ **Reconciliación Auditable**: Historial de snapshots con diferencias y notas.
- ✅ **Ajustes Explícitos**: Cierre de brechas mediante transacciones automáticas marcadas.
- ✅ **Categorización Inteligente**: Sugerencias basadas en historial y reglas heurísticas.
- ✅ **UI Mobile-First**: Diseñada para una entrada de datos rápida y sin fricción.

## Lo que esta App NO hace (Por diseño)
- **No sincroniza con APIs bancarias**: Mantiene el control absoluto en el usuario.
- **No edita reconciliaciones pasadas**: Lo que se cerró, queda como registro histórico para auditoría.
- **No "maquilla" saldos**: Si falta dinero, el sistema pide una nota y crea un movimiento de ajuste.

## Stack Tecnológico
- React 18 + TypeScript + Vite
- TailwindCSS (Premium UI)
- Dexie.js (IndexedDB wrapper)
- Zod (Validación de esquema)

## Cómo empezar
1. `npm install`
2. `npm run dev`
3. Abre `localhost:5173` y empieza a tomar el control de tu dinero.
