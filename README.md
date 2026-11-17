# Presupuestador · Gesetec Calderas

Sistema para armar y mandar presupuestos con la marca de Gesetec en minutos, desde la compu o el celular. Lo usan Leo (administrador) y administración (ventas). Va en `presupuestos.gesetecalderas.com`.

Sigue la misma línea que Farmacia Amancio Fernández y Brox Padel, con el diseño de gesetecalderas.com (Archivo variable, azul noche, la llama y el rojo para la acción principal).

```
apps/
  api/   NestJS 11 + Drizzle ORM (PostgreSQL) · exceljs · sharp · Swagger en /api/docs
    seed/   fotos de los equipos de los presupuestos reales de Leo
  web/   Next.js 16 (App Router) · Tailwind 4 · TanStack Query · el panel completo
deploy/  PM2, Nginx del subdominio y script para actualizar en el VPS
```

## Cómo levantarlo en Windows (o Mac / Linux)

Necesitás:
- **Node.js 20 o superior**: https://nodejs.org (versión LTS)
- **Docker Desktop**, solo para la base de datos. Si ya tenés PostgreSQL instalado, poné su URL en `DATABASE_URL` de `apps/api/.env`.

En PowerShell, dentro de esta carpeta:

```bash
npm install        # instala todo (la primera vez tarda unos minutos)
npm run setup      # crea los .env, levanta Postgres (puerto 5434), crea las tablas y carga los datos iniciales
npm run dev        # API en http://localhost:4000 y panel en http://localhost:3000
```

| Usuario | Email | Contraseña | Puede |
|---|---|---|---|
| Leo | `leo@gesetecalderas.com` | `Gesetec2026!` | todo: costos, márgenes, listas, dólar y usuarios |
| Administración | `administracion@gesetecalderas.com` | `Ventas2026!` | buscar precios y armar presupuestos (ve el precio final) |

Cambiá las contraseñas desde **Administración → Usuarios** apenas entres, o antes del setup en `apps/api/.env`.

Otros comandos: `npm run build` (compila API y panel), `npm run start` (corre lo compilado), `npm run seed:reset` (vuelve a cargar catálogo, plantillas y notas desde cero, sin tocar usuarios).

## Qué tiene (entrega 1)

**Precios**
- **Listas de precios por firma**: moneda (pesos o dólares), regla (*lista de costo + ganancia*, *lista al público − beneficio* o *precio fijo*) e IVA (incluido o "+ IVA").
- **Dólar oficial Banco Nación (venta)**: se consulta solo cada hora en dolarapi.com y se guarda. Si la fuente falla, queda el último valor. Se puede fijar a mano desde *Administración → Empresa y dólar*.
- **Cálculo del precio final**: equipos, repuestos y materiales salen con IVA incluido; la mano de obra y los servicios, sin IVA ("si requiere factura, se suma el IVA"). En dólares se pasa a pesos con el BNA venta y se redondea (a $1, $100 o $1.000).
- **Actualizar precios por %**: por marca, lista o tipo, con vista previa antes de aplicar.

**Excel**
- **Importar la lista de una firma** (.xlsx o .csv): busca solo las columnas de código, descripción, precio y tipo, muestra qué es nuevo, qué cambia de precio y qué queda igual, y recién ahí aplica. Actualiza por marca + código, así cada lista nueva solo cambia precios.
- **Exportar el catálogo** con la marca, formato de pesos y dólares, filtros y la primera fila fija. Hay una plantilla para descargar.

**Catálogo, plantillas y administración**
- Catálogo con buscador por código, nombre o marca (sin acentos: "peisa 24", "cp30", "r-ntc"), fotos de los equipos y edición para el administrador.
- Plantillas (caldera mural, comparativa, caldera de pie, climatizador de piscina, piso radiante, service y puesta en marcha) con lo que incluye cada venta, y notas con regla (IVA, instalación aparte, validez de 48 hs, forma de pago).
- Administración con la grilla de módulos (`apps/web/src/lib/modulos.ts`), los "Próximamente", usuarios, datos de la empresa y el registro de actividad.

## Lo que sigue

- **Entrega 2**: armado del presupuesto en 3 pasos (cliente → equipos y trabajos → revisar y enviar), comparativas, vista previa en vivo, PDF con la marca y envío por WhatsApp. Las tablas ya están en la base (`quotes`, `quote_groups`, `quote_items`, `share_links`).
- **Entrega 3**: clientes e historial, exportar presupuestos a Excel, copias de seguridad, deploy y capacitación.

## Para Leo: cómo cargar una lista

1. *Administración → Listas de precios → Nueva lista*: nombre (por ejemplo, "Peisa · dólares"), marca, moneda, si es de costo (con tu % de ganancia) o al público (con tu % de beneficio), y si trae IVA.
2. *Importar Excel* en esa lista: elegís el archivo tal cual lo manda la firma, revisás lo que cambia y aplicás.
3. Cuando la firma mande una lista nueva, repetís el paso 2: se actualizan los precios por código.

## Producción (VPS)

Está instalado en el VPS en **`/root/gesetec-presupuestador`** (la convención del servidor: código en `/root/<proyecto>`), clonado de `github.com/Aromcho/presupuestador`. Las fotos van en **`/var/www/presupuestos.gesetecalderas.com/uploads`**, porque Nginx no puede leer `/root` (`UPLOADS_DIR` en `apps/api/.env`).

**Actualizar** (lo de todos los días): `git push` desde la PC y después el deploy **`presupuestador`** del MCP del VPS (desde Claude), que hace `git pull --ff-only && bash deploy/update.sh`: compila al costado, migra y recarga sin cortar. También sirve **`Actualizar presupuestos.gesetecalderas.com.bat`**, que hace lo mismo por SSH.

**Instalar desde cero** (un servidor nuevo o una reinstalación): **`Subir a presupuestos.gesetecalderas.com.bat`**, con `root@IP-del-VPS`. Clona el repo en `/root/gesetec-presupuestador` (o lo actualiza si ya está) y corre `deploy/install.sh`, que:
- chequea Node, PM2, Nginx y Certbot, y que los puertos **4130** (API) y **3130** (panel) estén libres;
- crea la base `gesetec` en el PostgreSQL del servidor (o en Docker si no hay) y los `.env` con secretos y **contraseñas nuevas** (las muestra al final: anotalas);
- instala, compila, migra, carga los datos iniciales y arranca `gesetec-api` y `gesetec-web` con PM2;
- agrega **solo** su sitio a Nginx (`nginx -t` antes de recargar) y pide el certificado HTTPS.

Antes de correrlo, el subdominio **presupuestos.gesetecalderas.com** tiene que apuntar (registro A) a la IP del VPS. Si el certificado falla por el DNS, se vuelve a correr y listo: no pisa nada.

Backup: la base (`pg_dump gesetec`) y la carpeta de fotos `/var/www/presupuestos.gesetecalderas.com/uploads`.
