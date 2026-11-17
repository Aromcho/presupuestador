export type Role = 'ADMIN' | 'VENTAS';
export type ItemType = 'EQUIPO' | 'REPUESTO' | 'MATERIAL' | 'MANO_DE_OBRA' | 'SERVICIO';
export type Currency = 'ARS' | 'USD';
export type PriceRule = 'COSTO_MAS_MARGEN' | 'LISTA_MENOS_DESCUENTO' | 'PRECIO_FIJO';
export type NoteRule = 'SIEMPRE' | 'SI_PRODUCTOS' | 'SI_MANO_DE_OBRA' | 'SI_SIN_INSTALACION' | 'MANUAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active?: boolean;
  lastLoginAt?: string | null;
}

export interface Dolar {
  venta: number | null;
  compra: number | null;
  fecha: string | null;
  fuente: 'BNA oficial' | 'manual' | 'sin datos';
  modo: 'auto' | 'manual';
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface Item {
  id: string;
  type: ItemType;
  code: string | null;
  name: string;
  description: string | null;
  brand: { id: string; name: string } | null;
  priceList: { id: string; name: string } | null;
  photo: { sm: string; md: string } | null;
  currency: Currency;
  unit: string;
  active: boolean;
  price: { ars: number; withIva: boolean; needsDollar: boolean; net?: number; quoted?: number };
  // Solo administrador
  listPrice?: number;
  rule?: PriceRule;
  percent?: number;
  ruleOverride?: PriceRule | null;
  percentOverride?: number | null;
  ivaIncluded?: boolean;
  ivaRate?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PriceList {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  currency: Currency;
  rule: PriceRule;
  percent: number;
  ivaIncluded: boolean;
  ivaRate: number;
  validFrom: string | null;
  notes: string | null;
  active: boolean;
  itemCount: number;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  title: string;
  icon: string;
  mode: 'SUMA' | 'COMPARATIVA';
  seIncluye: string[];
  sortOrder: number;
  active: boolean;
  items: { id: string; qty: number; item: { id: string; name: string; code: string | null; type: ItemType } }[];
}

export interface Note {
  id: string;
  text: string;
  rule: NoteRule;
  sortOrder: number;
  active: boolean;
}

export interface Empresa {
  nombre: string;
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  direccion: string;
  localidad: string;
  telefono: string;
  whatsapp: string;
  email: string;
  web: string;
  instagram: string;
  zonas: string[];
  marcas: string[];
}

export interface AjustesPresupuestos {
  proximoNumero: number;
  validezHoras: number;
  formaPago: string;
  redondeo: number;
  pie: string;
}

export interface Activity {
  id: string;
  action: string;
  entity: string;
  summary: string | null;
  createdAt: string;
}
