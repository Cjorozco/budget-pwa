# 0010 — App gratis completa: sin PRO ni licencias
- Estado: aceptada (reemplaza a 0004 y 0005)
- Fecha: 2026-11-10

## Contexto
La app nació para uso propio: dejar el Excel y registrar todo rápido desde el celular. Se pensó en monetizarla y por eso existía un plan PRO, activado con una licencia de Lemon Squeezy (ADR 0004), que al final quedó en un aporte único de monto libre (ADR 0005).

PRO bloqueaba la IA, la exportación a CSV y ponía límites al plan básico (2 cuentas, 1 fondo de reserva, 2 plantillas). Ese bloqueo ya no se sostiene:
- Las apps de presupuesto tienen mucha competencia; cobrar por funciones básicas no tiene retorno.
- La IA es BYOK: dos proveedores tienen capa gratuita y en los otros dos el usuario ya le paga al proveedor. Cobrar además por el permiso de pegar la clave no agrega nada.
- La app no tiene costos por usuario: no hay backend y los datos viven en el dispositivo.
- Mantener el sistema de licencias (activación, revalidación cada 24 h, gracia sin conexión, compuerta de publicación) era complejidad sin uso.

## Decisión
- **Todo es gratis.** Sin límites de cuentas, reservas ni plantillas. IA (BYOK) y exportación CSV abiertas para todos.
- **Se elimina el sistema de licencias completo:** `licenseStore`, `src/lib/license/`, `UpgradeModal`, `ProBadge`, sus pruebas, las variables `VITE_LEMON_STORE_ID` y `VITE_LEMON_PRO_*`, y `api.lemonsqueezy.com` del CSP. La app ya no llama a la API de Lemon Squeezy.
- **El apoyo es voluntario.** En Ajustes queda la sección "Apoya el proyecto" con el botón "Invítame un café": un enlace al checkout de Lemon Squeezy (`VITE_LEMON_CHECKOUT_URL`) que se abre en otra pestaña. No desbloquea nada y el texto lo dice. Si la variable está vacía, la sección no se muestra.
- **No se limpia `localStorage`.** La entrada `personal_budget_license` de quien tenía una licencia queda sin uso; no contiene datos financieros.

## Consecuencias
- Menos código y menos casos: desaparecen el estado de licencia, la revalidación en línea y los avisos de licencia vencida o sin conexión.
- Quien ya aportó deja de ver el distintivo PRO, y la clave que recibió por correo ya no se usa en la app. Conviene desactivar las claves de licencia en el producto de Lemon Squeezy y revisar que su descripción no prometa desbloquear nada.
- Si más adelante una función con costo real justifica cobrar, se decide en un ADR nuevo. El sistema anterior está en el historial de git (hasta la versión 2.10.1).
