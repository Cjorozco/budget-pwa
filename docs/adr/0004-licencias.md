# 0004 — Licencias: solo Lemon Squeezy, verificado en línea
- Estado: aceptada
- Fecha: 2026-10-10

## Contexto
Una auditoría del sistema de licencias de la versión 2.2.0 (ejecutando el validador real con entradas inventadas) mostró cinco formas de obtener PRO o GOD sin pagar:
1. Claves maestras GOD escritas en el código fuente.
2. Claves "firmadas" falsificables: el checksum era un hash sin secreto (la sal estaba en el propio código) y el generador se exportaba.
3. Cualquier UUID se aceptaba como PRO vitalicio sin conexión.
4. Lo mismo con conexión si Lemon Squeezy respondía algo inusable.
5. Una licencia real de **otra** tienda de Lemon Squeezy (cualquiera puede crear un producto gratis), y si el producto se llamaba "god" daba GOD.

Además la bandera `budget_is_pro` en `localStorage` concedía PRO, existía un segundo `isPro` fuera del store de licencias que gobernaba la IA y se desincronizaba al activar o desactivar, las suscripciones mensuales y anuales nunca caducaban (`expiresAt` no se comparaba) y no había revalidación: un reembolso seguía funcionando.

## Decisión
- **Solo una licencia real de nuestra tienda concede un plan, y siempre activada en línea.** No existe ningún formato de clave que se acepte sin Lemon Squeezy. Se eliminan claves maestras, firmadas, UUID sin conexión y la bandera `budget_is_pro` (se borra al arrancar).
- **Verificación de tienda y producto.** Se comprueba `store_id` y que el producto o la variante estén en la lista de PRO o de GOD. Los IDs viven en `.env` (`VITE_LEMON_*`): no son secretos y así se cambian sin tocar código. **Sin ellos falla cerrado**: no se puede activar nada, y la revalidación no da veredicto para no sacar a quien ya pagó por un despliegue mal configurado.
- **Ciclo de vida.** Se guarda el `instance_id`; se revalida cada 24 h; hay **14 días de gracia sin conexión** (la app es offline-first: pasado ese plazo se suspende PRO, sin tocar los datos, hasta reconectar); se aplica `expiresAt`; al cerrar sesión se desactiva la instancia para liberar la activación. Un error de red nunca es un veredicto.
- **Una sola fuente de verdad.** La IA depende del store de licencias; se elimina `isPro`/`unlockPro` de `useUIStore`.
- **Migración única.** Quien tenía una clave que no es de Lemon Squeezy vuelve a Free con un aviso; quien tenía una licencia UUID sin validar conserva PRO y la gracia empieza al arrancar.
- **Compuerta de publicación.** `src/__tests__/release/` falla mientras los IDs de `.env` estén vacíos, para que una versión sin ellos no se pueda publicar por error.

## Consecuencias
- **Riesgo residual aceptado:** no hay backend (decisión de privacidad), así que todo control es del lado del cliente y quien modifique el JavaScript sigue pudiendo saltárselo. El cambio sube el listón de "trivial" a "requiere esfuerzo" y arregla la experiencia de los clientes legítimos.
- Las claves maestras anteriores dejan de funcionar. Para uso propio o familiar hay que crear en Lemon Squeezy licencias reales (por ejemplo una variante GOD con cupón del 100 %), con un límite de activaciones suficiente para varios dispositivos.
- Los mensajes de error de licencias están en español para todos los idiomas.
- Un cliente sin internet durante más de 14 días pierde PRO hasta reconectar.
