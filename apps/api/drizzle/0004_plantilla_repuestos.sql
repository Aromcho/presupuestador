-- Plantilla "Repuestos" (pedido de Leo, 19/11/2026). Solo se crea si no existe.
INSERT INTO "templates" ("name", "slug", "title", "icon", "mode", "se_incluye", "notes", "sort_order", "active")
SELECT 'Repuestos', 'repuestos', 'Repuestos', 'caja', 'SUMA', '{}'::text[], '{}'::text[], 7, true
WHERE NOT EXISTS (SELECT 1 FROM "templates" WHERE "name" = 'Repuestos');
