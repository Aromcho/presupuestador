import type { Currency, ItemType, PriceRule } from '../../db/schema';
import { PRODUCT_TYPES } from '../../db/schema';

export interface PricingInput {
  type: ItemType;
  currency: Currency;
  listPrice: number;
  rule: PriceRule;
  percent: number;
  ivaIncluded: boolean;
  ivaRate: number;
}

export interface PriceResult {
  /** Precio neto en la moneda de la lista, después de la regla (sin tocar el IVA) */
  net: number;
  /** Precio en la moneda de la lista como se cotiza: productos con IVA incluido; mano de obra y servicios, sin IVA */
  quoted: number;
  /** Precio final en pesos, redondeado */
  ars: number;
  /** true si el precio final incluye IVA (productos, o servicios de una lista con IVA incluido) */
  withIva: boolean;
}

/**
 * Regla de precios de Gesetec:
 * - Lista de costo → + ganancia %. Lista al público → − beneficio %. Precio fijo → tal cual.
 * - Equipos, repuestos y materiales salen con IVA incluido (si la lista viene "+ IVA", se suma).
 * - Mano de obra y servicios salen sin IVA ("si requiere factura, se suma el IVA"), salvo que la lista
 *   sea de precio final con IVA (ej.: tarifario de servicio técnico): ahí salen tal cual, IVA incluido.
 * - Si la lista está en dólares, se pasa a pesos con el dólar BNA venta y se redondea.
 */
/** Valor de `rounding` para redondear hacia arriba a números redondos, como lo hace Leo (solo los precios que vienen en dólares) */
export const REDONDEO_ARRIBA = -1;

/** Hacia arriba: hasta $100.000, al $1.000 siguiente; hasta $1.000.000, a los $5.000; desde ahí, a los $50.000. Ej.: $4.253.000 → $4.300.000 */
export function redondearArriba(n: number): number {
  const step = n < 100_000 ? 1_000 : n < 1_000_000 ? 5_000 : 50_000;
  return Math.ceil(n / step - 1e-9) * step;
}

export function priceOf(i: PricingInput, dollarSell: number | null, rounding = 100): PriceResult {
  const factor = i.rule === 'COSTO_MAS_MARGEN' ? 1 + i.percent / 100 : i.rule === 'LISTA_MENOS_DESCUENTO' ? 1 - i.percent / 100 : 1;
  const net = i.listPrice * factor;
  const isProduct = PRODUCT_TYPES.includes(i.type);
  let quoted = net;
  if (isProduct && !i.ivaIncluded) quoted = net * (1 + i.ivaRate / 100);
  const rate = i.currency === 'USD' ? (dollarSell ?? 0) : 1;
  const raw = quoted * rate;
  let ars = 0;
  if (raw > 0 && rounding === REDONDEO_ARRIBA) ars = i.currency === 'USD' ? redondearArriba(raw) : Math.round(raw / 100) * 100;
  else if (raw > 0) {
    const step = Math.max(1, rounding);
    ars = Math.round(raw / step) * step;
  }
  return { net: round2(net), quoted: round2(quoted), ars, withIva: isProduct || i.ivaIncluded };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
