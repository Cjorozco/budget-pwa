# 0005 — Un solo plan: aporte único "invítame un café"
- Estado: aceptada
- Fecha: 2026-10-15

## Contexto
La app se hizo para uso propio. Se pensó venderla con tres precios para PRO (mensual US$0,99, anual US$7,99, vitalicio US$19,99) y un nivel GOD "próximamente", pero no hay usuarios fuera del autor, ni siquiera familia o amigos. Mantener suscripciones, dos niveles pagos y la lógica de planes (`planType`, variantes mensual/anual/vitalicia, deducción por fecha de vencimiento) es complejidad sin retorno.

Además la app no tiene costos que se repitan por usuario: los datos viven en el dispositivo (Dexie), no hay backend y la IA usa la API key de cada persona (BYOK). Nada justifica cobrar de forma recurrente.

## Decisión
- **Un solo plan pago: PRO, con un pago único** tipo "invítame un café". En Lemon Squeezy es una variante de pago único con precio libre (*pay what you want*) dentro del producto PRO, con licencias activadas. Las variantes mensual y anual se archivan.
- **GOD desaparece y se fusiona con PRO.** `Tier` pasa a `'free' | 'pro'`. Una licencia guardada como GOD se carga como PRO; el campo `planType` se ignora.
- **Se elimina la noción de plan.** Fuera `PlanType`, `planType`, `VITE_LEMON_GOD_*` y `VITE_LEMON_{MONTHLY,ANNUAL,LIFETIME}_VARIANT_IDS`. Basta `VITE_LEMON_PRO_PRODUCT_IDS`: cualquier variante del producto da PRO.
- **Se mantiene todo lo demás de ADR 0004:** activación en línea, verificación de tienda y producto, revalidación cada 24 h, 14 días de gracia sin conexión y respeto de `expiresAt` (lo necesitan las licencias de suscripción que ya existían).
- **La UI cambia de tono:** de "planes y precios" a "apoyar el proyecto", con un solo botón de pago.

## Lo que iba a traer GOD (queda como idea, no como compromiso)
El modal anunciaba un "Personal Budget GOD próximamente" con:
- Escaneo de recibos y facturas con la cámara (OCR).
- Importador de extractos bancarios en PDF o Excel.
- Asistente financiero autónomo.

No hay fecha ni plan para construirlo. La app evoluciona según lo que le falte al autor; si alguna de estas funciones se hace, entra en PRO.

## Consecuencias
- Quien ya tenía una licencia PRO (de cualquier variante del producto) o GOD sigue activo como PRO. Las suscripciones antiguas siguen caducando en su fecha.
- Menos código y menos casos: desaparecen la deducción de plan, el aviso de GOD y la promesa de descuento para "Lifetime".
- El monto mínimo lo define Lemon Squeezy; la UI no muestra precios fijos para no desincronizarse con la tienda.
