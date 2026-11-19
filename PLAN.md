# Plan y decisiones · Panel admin Gesetec

El plan técnico completo está en el proyecto de Claude ("plan-tecnico-presupuestador.md") y las pantallas, en el artifact "Presupuestador Gesetec · pantallas".

## Entregas
1. ✔ **Base, catálogo y administración**: monorepo como Farmacia/Brox, auth con roles (ADMIN / VENTAS), listas en dólares o pesos con reglas, dólar BNA automático, importar y exportar Excel, actualización por %, plantillas y notas, empresa, usuarios, actividad.
2. **Presupuesto y PDF**: armado en 3 pasos, comparativas, vista previa, PDF A4 con la marca (Playwright), link público y botón de WhatsApp.
3. **Clientes, Excel de presupuestos y puesta en marcha**: historial, estados, duplicar, exportar presupuestos, copias, deploy y capacitación.

## Decisiones
- **Precios**: el ítem guarda el precio tal cual figura en la lista (USD o ARS) y la lista define la regla, el % y el IVA. El precio final se calcula en el momento (`apps/api/src/common/utils/pricing.ts`), así un cambio de dólar o de % se refleja al instante. El presupuesto, cuando se emita, guarda una copia de cada ítem y el dólar usado.
- **IVA**: productos (equipos, repuestos, materiales) con IVA incluido; mano de obra y servicios sin IVA, como en los presupuestos de Leo.
- **Dólar**: dolarapi.com `/v1/dolares/oficial` (BNA venta), cada hora, con valor manual como respaldo.
- **Importación**: detección de columnas por título (código, descripción, precio, tipo/rubro), con corrección manual en la vista previa. Actualiza por marca + código; sin código, por nombre dentro de la misma lista.
- **Módulos futuros**: `apps/web/src/lib/modulos.ts` + un módulo de Nest + una carpeta en `(panel)` + su migración.
- **Next.js 16.4.6**: la 16.4.2 de Farmacia tiene un aviso de seguridad moderado (`use cache` + `unstable_cache`); acá ya va la corregida.
