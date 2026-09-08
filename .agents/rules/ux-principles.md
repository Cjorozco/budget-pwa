# Principios Universales de UX y Diseño Frontend

## Descripción
Heurísticas de experiencia de usuario (UX) y diseño visual para interfaces en React 19 y Tailwind CSS 4. El objetivo es mantener una baja carga cognitiva, accesibilidad y máxima fluidez táctil en un entorno mobile-first.

---

## Heurísticas y Reglas de Implementación

### 1. Gestión de Complejidad y Claridad (Ley de Tesler & Ley de Hick)
- **Abstracción Técnica:** Asume la complejidad (estado, transformaciones de datos) en el código para que la interfaz se mantenga limpia.
- **Límites de Decisión:** Limita las opciones presentadas al usuario simultáneamente (máximo 3 a 5).
- **Flujos Progresivos:** Prefiere flujos paso a paso (`multi-step`) usando estado local sobre formularios largos y abrumadores.
- **Lenguaje UI:** Copys directos y accionables (labels, tooltips, toasts) sin jerga técnica y en español de Colombia (`es-CO`).

### 2. Consistencia y Patrones (Ley de Jakob)
- **Reutilización Estricta:** Construir ensamblando componentes base, *design tokens* y utilidades ya existentes en `src/components/ui/`. No reinventar componentes si ya existe un equivalente.
- **Familiaridad:** Patrones estándar de navegación (barra inferior fija en móvil, diálogos modales accesibles con backdrop). Evitar animaciones superfluas que retrasen la interacción.

### 3. Flexibilidad de Entradas y Prevención de Errores (Ley de Postel)
- **Inputs Resilientes:** Estricto en lo que se envía a la persistencia (Dexie / IndexedDB), pero flexible y tolerante en lo que se recibe del usuario. Formateo y sanitización automática (COP, fechas, strings limpios) mediante Zod.
- **Tolerancia a Fallos:** Uso de `ErrorBoundary` (`src/components/ui/ErrorBoundary.tsx`) y manejo seguro de estados `null`/`undefined`.
- **Acciones Destructivas:** Exigir siempre confirmación explícita con semántica de advertencia antes de borrar o modificar datos sensibles mediante `ConfirmDialog` de UI store (nunca `window.confirm` ni alertas nativas).

### 4. Sistemas de Feedback (Peak-End Rule)
- **Visibilidad del Estado:** Feedback visual inmediato (spinners en botones, estados `disabled`, skeletons).
- **Notificaciones No Intrusivas:** Toasts mediante `useUIStore.getState().addToast(...)` para confirmar resultados exitosos o errores.

### 5. Arquitectura de UI y Jerarquía (Ley de Miller & Efecto von Restorff)
- **Agrupación Visual (Chunking):** Dividir la información en bloques lógicos cortos (máximo 7±2 elementos).
- **Jerarquía de Acción:** El Call to Action (CTA) principal de cada pantalla debe distinguirse visualmente de forma clara e intuitiva.

### 6. Accesibilidad (Ley de Fitts & Estándares Web)
- **Mobile-first:** Estilos base orientados a pantalla táctil pequeña, escalando progresivamente con Tailwind CSS 4.
- **Áreas de Interacción Táctil:** Botones y enlaces con tamaño mínimo de 44x44px y separación adecuada para pulsación con el pulgar.
- **Semántica y a11y:** HTML semántico, `aria-label` en botones con solo icono (Lucide), roles ARIA para diálogos y contraste de color WCAG AA tanto en modo claro como oscuro.

---

## Integraciones Específicas del Proyecto

1. **Stack:** SPA offline-first en **React 19 + Vite 7 + Tailwind CSS 4 + TypeScript**.
2. **Capa de Datos:** **IndexedDB vía Dexie.js** con reactividad mediante `useLiveQuery`.
3. **Moneda:** Todos los valores monetarios en **COP (Pesos Colombianos)** formateados con `formatCurrency()`.
4. **Componentes Clave:**
   - Diálogos destructivos: `useConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`).
   - Notificaciones y alertas: `useUIStore.getState().addToast(...)` (`src/components/ui/ToastContainer.tsx`).
   - Contención de excepciones: `ErrorBoundary` (`src/components/ui/ErrorBoundary.tsx`).
