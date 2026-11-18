import type { Currency, ItemType, NoteRule, PriceRule, QuoteStatus } from './types';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $ 2.700.000 */
export const pesos = (n: number | null | undefined) => (n == null ? '—' : ars.format(n));
/** U$S 1.650,00 o $ 1.650,00 */
export const moneda = (n: number | null | undefined, c: Currency) => (n == null ? '—' : `${c === 'USD' ? 'U$S' : '$'} ${usd.format(n)}`);

export const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    : '—';

export const TIPOS: Record<ItemType, string> = {
  EQUIPO: 'Equipo',
  REPUESTO: 'Repuesto',
  MATERIAL: 'Material',
  MANO_DE_OBRA: 'Mano de obra',
  SERVICIO: 'Servicio',
};

export const REGLAS: Record<PriceRule, { titulo: string; ayuda: string; pct: string }> = {
  COSTO_MAS_MARGEN: { titulo: 'Lista de costo + ganancia', ayuda: 'La firma pasa el precio de costo y le sumás tu ganancia.', pct: 'Ganancia' },
  LISTA_MENOS_DESCUENTO: { titulo: 'Lista al público − beneficio', ayuda: 'La firma pasa el precio al cliente y vos hacés un beneficio.', pct: 'Beneficio' },
  PRECIO_FIJO: { titulo: 'Precio fijo', ayuda: 'El precio va tal cual.', pct: '' },
};

export const NOTA_REGLAS: Record<NoteRule, string> = {
  SIEMPRE: 'Siempre',
  SI_PRODUCTOS: 'Si hay equipos o repuestos',
  SI_MANO_DE_OBRA: 'Si hay mano de obra o servicios sin IVA',
  SI_SIN_INSTALACION: 'Si no se suma instalación',
  SI_SERVICIO: 'Si hay servicio técnico',
  MANUAL: 'Solo si la agrego a mano',
};

export const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

export const ESTADOS: Record<QuoteStatus, { texto: string; tono: 'gris' | 'azul' | 'verde' | 'rojo' }> = {
  BORRADOR: { texto: 'Borrador', tono: 'gris' },
  ENVIADO: { texto: 'Enviado', tono: 'azul' },
  ACEPTADO: { texto: 'Aceptado', tono: 'verde' },
  RECHAZADO: { texto: 'Rechazado', tono: 'rojo' },
  VENCIDO: { texto: 'Vencido', tono: 'rojo' },
};

/** Productos (equipos, repuestos, materiales) van con IVA incluido; mano de obra y servicios, sin IVA */
export const esProducto = (t: ItemType) => t === 'EQUIPO' || t === 'REPUESTO' || t === 'MATERIAL';

/** Link de WhatsApp para escribirle a alguien (sin mensaje armado) */
export function waLink(phone: string | null | undefined, text = '') {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) for (const a of [2, 3, 4]) if (d.slice(a, a + 2) === '15') { d = d.slice(0, a) + d.slice(a + 2); break; }
  const num = d.startsWith('9') && d.length === 11 ? `54${d}` : d.length === 10 ? `549${d}` : d ? `54${d}` : '';
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
