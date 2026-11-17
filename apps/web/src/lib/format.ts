import type { Currency, ItemType, NoteRule, PriceRule } from './types';

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
  SI_MANO_DE_OBRA: 'Si hay mano de obra o servicios',
  SI_SIN_INSTALACION: 'Si no se suma instalación',
  MANUAL: 'Solo si la agrego a mano',
};
