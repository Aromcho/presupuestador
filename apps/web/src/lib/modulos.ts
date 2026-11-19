import type { Role } from './types';

/**
 * Registro de módulos: arma la grilla de Administración, el menú y los permisos.
 * Para sumar uno nuevo: módulo de Nest en apps/api/src/<id>, carpeta en app/(panel)/<id> y su línea acá.
 */
export interface Modulo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  ruta?: string;
  estado: 'activo' | 'proximamente' | 'oculto';
  rol: Role;
}

export const MODULOS: Modulo[] = [
  { id: 'presupuestos', nombre: 'Presupuestos', descripcion: 'Historial con estados, duplicar, reenviar y exportar a Excel.', icono: 'doc', ruta: '/presupuestos', estado: 'activo', rol: 'ADMIN' },
  { id: 'clientes', nombre: 'Clientes', descripcion: 'Ficha de cada cliente con sus presupuestos y su WhatsApp.', icono: 'clientes', ruta: '/clientes', estado: 'activo', rol: 'ADMIN' },
  { id: 'catalogo', nombre: 'Catálogo y precios', descripcion: 'Equipos, repuestos, mano de obra y materiales con su precio final.', icono: 'etiqueta', ruta: '/catalogo', estado: 'activo', rol: 'ADMIN' },
  { id: 'listas', nombre: 'Listas de precios y Excel', descripcion: 'Listas en dólares o pesos, con ganancia o beneficio. Importá y exportá Excel.', icono: 'excel', ruta: '/admin/listas', estado: 'activo', rol: 'ADMIN' },
  { id: 'plantillas', nombre: 'Plantillas y notas', descripcion: 'Lo que incluye cada venta y las aclaraciones que se agregan solas.', icono: 'plantilla', ruta: '/admin/plantillas', estado: 'activo', rol: 'ADMIN' },
  { id: 'empresa', nombre: 'Empresa y dólar', descripcion: 'Datos del encabezado, numeración, validez, redondeo y dólar BNA.', icono: 'empresa', ruta: '/admin/empresa', estado: 'activo', rol: 'ADMIN' },
  { id: 'usuarios', nombre: 'Usuarios y permisos', descripcion: 'Administrador ve costos y márgenes; ventas arma y manda.', icono: 'usuario', ruta: '/admin/usuarios', estado: 'activo', rol: 'ADMIN' },
  { id: 'actividad', nombre: 'Registro de actividad', descripcion: 'Quién cambió un precio, importó una lista o tocó el dólar.', icono: 'historial', ruta: '/admin/actividad', estado: 'activo', rol: 'ADMIN' },
  // Próximamente
  { id: 'service-anual', nombre: 'Recordatorio de service anual', descripcion: 'A los 11 meses le escribe al cliente por WhatsApp para agendar el service.', icono: 'campana', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'seguimiento', nombre: 'Seguimiento de presupuestos', descripcion: 'Si a las 48 hs no respondió, te avisa con el mensaje listo.', icono: 'reloj', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'ordenes', nombre: 'Órdenes de trabajo', descripcion: 'Del presupuesto aceptado a la orden para el técnico.', icono: 'llave', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'agenda', nombre: 'Agenda de técnicos', descripcion: 'Quién va, a dónde y a qué hora.', icono: 'calendario', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'pedidos-web', nombre: 'Pedidos desde la web', descripcion: 'El "Pedí tu service" de gesetecalderas.com entra directo acá.', icono: 'globo', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'stock', nombre: 'Stock de equipos', descripcion: 'Qué hay en el depósito y qué falta pedir.', icono: 'caja', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'estadisticas', nombre: 'Estadísticas', descripcion: 'Qué se vende, en qué zona y cuánto se cierra.', icono: 'grafico', estado: 'proximamente', rol: 'ADMIN' },
  { id: 'facturacion', nombre: 'Facturación electrónica', descripcion: 'La factura de ARCA desde el presupuesto aceptado.', icono: 'recibo', estado: 'proximamente', rol: 'ADMIN' },
];
