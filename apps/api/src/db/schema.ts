/**
 * Modelo de datos — Presupuestador Gesetec Calderas
 * PostgreSQL + Drizzle ORM. Los precios finales se guardan en pesos enteros (ARS);
 * los precios de lista de los proveedores, en su moneda (ARS o USD) con 2 decimales.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------- enums
export const roleEnum = pgEnum('role', ['ADMIN', 'VENTAS']);
export const itemTypeEnum = pgEnum('item_type', ['EQUIPO', 'REPUESTO', 'MATERIAL', 'MANO_DE_OBRA', 'SERVICIO']);
export const currencyEnum = pgEnum('currency', ['ARS', 'USD']);
/** COSTO_MAS_MARGEN: lista de costo + ganancia · LISTA_MENOS_DESCUENTO: lista al público − beneficio · PRECIO_FIJO: tal cual */
export const priceRuleEnum = pgEnum('price_rule', ['COSTO_MAS_MARGEN', 'LISTA_MENOS_DESCUENTO', 'PRECIO_FIJO']);
export const noteRuleEnum = pgEnum('note_rule', ['SIEMPRE', 'SI_PRODUCTOS', 'SI_MANO_DE_OBRA', 'SI_SIN_INSTALACION', 'MANUAL']);
export const quoteModeEnum = pgEnum('quote_mode', ['SUMA', 'COMPARATIVA']);
export const quoteStatusEnum = pgEnum('quote_status', ['BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO']);

export type Role = (typeof roleEnum.enumValues)[number];
export type ItemType = (typeof itemTypeEnum.enumValues)[number];
export type Currency = (typeof currencyEnum.enumValues)[number];
export type PriceRule = (typeof priceRuleEnum.enumValues)[number];
export type NoteRule = (typeof noteRuleEnum.enumValues)[number];
export type QuoteMode = (typeof quoteModeEnum.enumValues)[number];
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];

/** Tipos que se venden como producto (precio final con IVA incluido) */
export const PRODUCT_TYPES: ItemType[] = ['EQUIPO', 'REPUESTO', 'MATERIAL'];

// ---------------------------------------------------------------- helpers
const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });
const pct = (name: string) => numeric(name, { precision: 6, scale: 2, mode: 'number' });

export type MediaVariants = { sm: string; md: string };

// ---------------------------------------------------------------- usuarios y ajustes
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('VENTAS'),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Clave/valor: "empresa", "presupuestos" (numeración, validez, redondeo), "modulos" */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
});

export const media = pgTable('media', {
  id: id(),
  path: text('path').notNull(),
  variants: jsonb('variants').$type<MediaVariants>(),
  width: integer('width'),
  height: integer('height'),
  mime: text('mime'),
  sizeBytes: integer('size_bytes'),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- catálogo
export const brands = pgTable('brands', {
  id: id(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

/** Lista de precios de un proveedor: define moneda, regla, porcentaje e IVA para sus ítems */
export const priceLists = pgTable('price_lists', {
  id: id(),
  name: text('name').notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  currency: currencyEnum('currency').notNull().default('ARS'),
  rule: priceRuleEnum('rule').notNull().default('PRECIO_FIJO'),
  /** Ganancia (COSTO_MAS_MARGEN) o beneficio (LISTA_MENOS_DESCUENTO), en % */
  percent: pct('percent').notNull().default(0),
  /** ¿Los precios de la lista ya traen IVA? */
  ivaIncluded: boolean('iva_included').notNull().default(true),
  ivaRate: pct('iva_rate').notNull().default(21),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  /** Prefijos de código que no se importan (separados por coma). Ej.: "PEI" para no traer Peisa desde Hydraulic */
  excludeCodes: text('exclude_codes'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const items = pgTable(
  'items',
  {
    id: id(),
    type: itemTypeEnum('type').notNull().default('EQUIPO'),
    /** Código del proveedor (para buscar repuestos y actualizar listas) */
    code: text('code'),
    name: text('name').notNull(),
    description: text('description'),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    priceListId: uuid('price_list_id').references(() => priceLists.id, { onDelete: 'set null' }),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    currency: currencyEnum('currency').notNull().default('ARS'),
    /** Precio tal cual figura en la lista (o el precio fijo propio) */
    listPrice: money('list_price').notNull().default(0),
    /** Si se completan, pisan la regla y el % de la lista */
    ruleOverride: priceRuleEnum('rule_override'),
    percentOverride: pct('percent_override'),
    ivaIncluded: boolean('iva_included').notNull().default(true),
    ivaRate: pct('iva_rate').notNull().default(21),
    unit: text('unit').notNull().default('u.'),
    /** Texto normalizado (sin acentos, minúsculas) con código, nombre y marca para buscar */
    searchText: text('search_text').notNull().default(''),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('items_brand_code_unique').on(t.brandId, t.code),
    index('items_type_idx').on(t.type),
    index('items_list_idx').on(t.priceListId),
    index('items_code_idx').on(t.code),
  ],
);

export const exchangeRates = pgTable('exchange_rates', {
  id: id(),
  /** "dolarapi:oficial" o "manual" */
  source: text('source').notNull(),
  buy: money('buy'),
  sell: money('sell').notNull(),
  /** Fecha de la cotización según la fuente */
  quotedAt: timestamp('quoted_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- plantillas y notas
export const notes = pgTable('notes', {
  id: id(),
  text: text('text').notNull(),
  rule: noteRuleEnum('rule').notNull().default('SIEMPRE'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templates = pgTable('templates', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  /** Título que aparece en el presupuesto */
  title: text('title').notNull(),
  icon: text('icon').notNull().default('instalacion'),
  mode: quoteModeEnum('mode').notNull().default('SUMA'),
  seIncluye: textArray('se_incluye'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templateItems = pgTable('template_items', {
  id: id(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  qty: numeric('qty', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------------------------------------------------------------- clientes y presupuestos (semana 2)
export const clients = pgTable(
  'clients',
  {
    id: id(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    zone: text('zone'),
    address: text('address'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('clients_name_idx').on(t.name)],
);

export const quotes = pgTable(
  'quotes',
  {
    id: id(),
    number: integer('number').notNull().unique(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    mode: quoteModeEnum('mode').notNull().default('SUMA'),
    status: quoteStatusEnum('status').notNull().default('BORRADOR'),
    validityHours: integer('validity_hours').notNull().default(48),
    paymentTerms: text('payment_terms'),
    seIncluye: textArray('se_incluye'),
    notes: textArray('notes'),
    observations: text('observations'),
    /** Dólar BNA venta usado para calcular los precios en pesos */
    dollarSell: money('dollar_sell'),
    dollarAt: timestamp('dollar_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('quotes_status_idx').on(t.status), index('quotes_client_idx').on(t.clientId)],
);

export const quoteGroups = pgTable('quote_groups', {
  id: id(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default('Opción A'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Copia del ítem al momento de emitir: si el catálogo cambia, el presupuesto queda igual */
export const quoteItems = pgTable('quote_items', {
  id: id(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => quoteGroups.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
  type: itemTypeEnum('type').notNull(),
  code: text('code'),
  name: text('name').notNull(),
  description: text('description'),
  photoPath: text('photo_path'),
  unitPrice: integer('unit_price').notNull(),
  qty: numeric('qty', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
  discountPct: pct('discount_pct').notNull().default(0),
  ivaIncluded: boolean('iva_included').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const shareLinks = pgTable('share_links', {
  id: id(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- actividad
export const activity = pgTable(
  'activity',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    summary: text('summary'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: createdAt(),
  },
  (t) => [index('activity_created_idx').on(t.createdAt)],
);

// ---------------------------------------------------------------- relaciones
export const itemsRelations = relations(items, ({ one }) => ({
  brand: one(brands, { fields: [items.brandId], references: [brands.id] }),
  priceList: one(priceLists, { fields: [items.priceListId], references: [priceLists.id] }),
  media: one(media, { fields: [items.mediaId], references: [media.id] }),
}));

export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
  brand: one(brands, { fields: [priceLists.brandId], references: [brands.id] }),
  items: many(items),
}));

export const templatesRelations = relations(templates, ({ many }) => ({
  items: many(templateItems),
}));

export const templateItemsRelations = relations(templateItems, ({ one }) => ({
  template: one(templates, { fields: [templateItems.templateId], references: [templates.id] }),
  item: one(items, { fields: [templateItems.itemId], references: [items.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  user: one(users, { fields: [quotes.userId], references: [users.id] }),
  template: one(templates, { fields: [quotes.templateId], references: [templates.id] }),
  groups: many(quoteGroups),
  shareLinks: many(shareLinks),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  quotes: many(quotes),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  quote: one(quotes, { fields: [shareLinks.quoteId], references: [quotes.id] }),
}));

export const quoteGroupsRelations = relations(quoteGroups, ({ one, many }) => ({
  quote: one(quotes, { fields: [quoteGroups.quoteId], references: [quotes.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  group: one(quoteGroups, { fields: [quoteItems.groupId], references: [quoteGroups.id] }),
}));
