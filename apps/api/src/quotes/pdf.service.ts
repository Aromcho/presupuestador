import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { AjustesPresupuestos, CompanyService, Empresa } from '../company/company.service';
import { slugify } from '../common/utils/text';
import { PRODUCT_TYPES } from '../db/schema';
import type { QuoteDetail } from './quotes.service';

// Paleta de gesetecalderas.com, versión para imprimir (fondo claro)
const C = {
  noche: '#040B1D',
  marino: '#0B1A38',
  rojo: '#E3322A',
  azul: '#3371D1',
  celeste: '#B9C8F0',
  texto: '#0B1A38',
  gris: '#5A6A8E',
  linea: '#E1E7F2',
  fondo: '#F4F7FC',
};

const W = 595.28;
const H = 841.89;
const M = 40;
const CW = W - 2 * M;
const BOTTOM = H - 66;

const FONTS = { r: '400', s: '600', b: '700', x: '800' } as const;
type Font = keyof typeof FONTS;

// Íconos de trazo (24×24) para la franja de contacto
const ICONOS = {
  chat: 'M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z',
  camara: 'M4.5 7.5h3l1.6-2.5h5.8l1.6 2.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5zM12 16.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z',
  globo: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z',
};

const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const cantidad = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n);
const fechaLarga = (d: Date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(d);
const fechaCorta = (d: Date) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(d);

/**
 * PDF del presupuesto con la marca de Gesetec. Se arma con pdfkit (sin navegador), así no carga la memoria del VPS.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger('PDF');
  private logo?: Promise<Buffer | null>;

  constructor(
    private readonly company: CompanyService,
    private readonly config: ConfigService,
  ) {}

  private get uploads() {
    return resolve(this.config.get<string>('UPLOADS_DIR') ?? './uploads');
  }

  /** Logos blancos de las marcas (los mismos de gesetecalderas.com), en el orden de Empresa → marcas */
  private marcas(nombres: string[]) {
    const out: { buf: Buffer; ratio: number }[] = [];
    for (const n of nombres) {
      const file = resolve(__dirname, '../../assets/marcas', `${slugify(n)}.png`);
      if (!existsSync(file)) continue;
      const buf = readFileSync(file);
      // ancho/alto desde el encabezado PNG
      out.push({ buf, ratio: buf.readUInt32BE(16) / buf.readUInt32BE(20) });
    }
    return out;
  }

  private logoPng() {
    this.logo ??= (async () => {
      const file = resolve(__dirname, '../../assets/gesetec-logo.svg');
      if (!existsSync(file)) return null;
      return sharp(file, { density: 300 }).resize({ height: 240 }).png().toBuffer();
    })().catch((e) => {
      this.logger.warn(`No se pudo preparar el logo: ${(e as Error).message}`);
      return null;
    });
    return this.logo;
  }

  private async photo(path: string | null) {
    if (!path) return null;
    const file = join(this.uploads, path);
    if (!existsSync(file)) return null;
    try {
      return await sharp(file).resize({ width: 220, height: 220, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return null;
    }
  }

  async render(q: QuoteDetail): Promise<Buffer> {
    const [empresa, ajustes, logo] = await Promise.all([this.company.empresa(), this.company.presupuestos(), this.logoPng()]);
    const photos = new Map<string, Buffer>();
    await Promise.all(
      q.groups.flatMap((g) =>
        g.items.map(async (i) => {
          const b = await this.photo(i.photoPath);
          if (b) photos.set(i.id, b);
        }),
      ),
    );
    return this.draw(q, empresa, ajustes, logo, photos);
  }

  private draw(q: QuoteDetail, empresa: Empresa, ajustes: AjustesPresupuestos, logo: Buffer | null, photos: Map<string, Buffer>): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M, bottom: 20, left: M, right: M },
      bufferPages: true,
      info: { Title: `Presupuesto · ${empresa.nombre}`, Author: empresa.nombre, Subject: q.title },
    });
    for (const [k, w] of Object.entries(FONTS)) doc.registerFont(k, require.resolve(`@fontsource/archivo/files/archivo-latin-${w}-normal.woff`));
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(chunks))));

    const font = (f: Font, size: number, color: string = C.texto) => doc.font(f).fontSize(size).fillColor(color);
    const etiqueta = (t: string, x: number, y: number, color: string = C.gris, opts: PDFKit.Mixins.TextOptions = {}) => {
      font('b', 7.5, color).text(t.toUpperCase(), x, y, { characterSpacing: 1.4, lineBreak: false, ...opts });
    };
    const fecha = q.createdAt instanceof Date ? q.createdAt : new Date(q.createdAt);
    const degrade = (y: number, h: number) => {
      const g = doc.linearGradient(0, y, W, y);
      g.stop(0, C.azul).stop(1, C.rojo);
      doc.rect(0, y, W, h).fill(g);
    };

    // ---------------------------------------------------------- encabezado
    const encabezado = (primera: boolean) => {
      if (primera) {
        doc.rect(0, 0, W, 124).fill(C.marino);
        if (logo) doc.image(logo, M, 30, { height: 62 });
        else font('x', 22, '#ffffff').text(empresa.nombre, M, 46);
        // Fecha y validez grandes (pedido de Leo): la fecha se achica sola si no entra
        const rw = 290;
        const rx = W - M - rw;
        etiqueta('Presupuesto', rx, 26, C.celeste, { width: rw, align: 'right' });
        const ft = fechaLarga(fecha);
        let fs = 23;
        doc.font('x');
        while (fs > 15 && doc.fontSize(fs).widthOfString(ft) > rw) fs -= 0.5;
        font('x', fs, '#ffffff').text(ft, rx, 40, { width: rw, align: 'right', lineBreak: false });
        const vt = `Válido por ${q.validityHours} horas`;
        doc.font('x').fontSize(12.5);
        const ph = 26;
        const pw = doc.widthOfString(vt) + 30;
        const px = W - M - pw;
        doc.roundedRect(px, 76, pw, ph, ph / 2).fill(C.rojo);
        font('x', 12.5, '#ffffff').text(vt, px, 76 + 7, { width: pw, align: 'center', lineBreak: false });
        degrade(124, 4);
        return 152;
      }
      doc.rect(0, 0, W, 50).fill(C.marino);
      if (logo) doc.image(logo, M, 13, { height: 24 });
      font('s', 9, C.celeste).text(`Presupuesto · ${fechaLarga(fecha)} · continuación`, W - M - 250, 21, { width: 250, align: 'right', lineBreak: false });
      degrade(50, 3);
      return 74;
    };

    let y = encabezado(true);
    const asegurar = (h: number) => {
      if (y + h > BOTTOM) {
        doc.addPage();
        y = encabezado(false);
      }
    };

    // ---------------------------------------------------------- cliente
    const c = q.client;
    etiqueta('Para', M, y);
    font('b', 14).text(c?.name ?? 'Cliente', M, y + 12, { width: CW });
    let yc = doc.y + 2;
    const datos = [c?.phone, c?.zone, c?.address].filter(Boolean).join(' · ');
    if (datos) {
      font('r', 9.5, C.gris).text(datos, M, yc, { width: CW });
      yc = doc.y;
    }
    y = yc + 18;

    // ---------------------------------------------------------- título
    font('x', 20).text(q.title, M, y, { width: CW });
    y = doc.y + 4;
    if (q.mode === 'COMPARATIVA' && q.groups.length > 1) {
      font('r', 9.5, C.gris).text('Compará las opciones: cada una tiene su precio final.', M, y, { width: CW });
      y = doc.y;
    }
    y += 14;

    // ---------------------------------------------------------- ítems
    const filaItem = (i: QuoteDetail['groups'][number]['items'][number]) => {
      const foto = photos.get(i.id);
      const tx = M + (foto ? 62 : 0);
      const tw = CW - (tx - M) - 140;
      const meta = [i.code, i.description].filter(Boolean).join(' · ');
      font('b', 10.5);
      const hName = doc.heightOfString(i.name, { width: tw });
      font('r', 8.5);
      const hMeta = meta ? doc.heightOfString(meta, { width: tw }) + 2 : 0;
      const sub: string[] = [];
      if (i.qty !== 1) sub.push(`${cantidad(i.qty)} × ${pesos(i.unitPrice)}`);
      if (i.discountPct) sub.push(`− ${cantidad(i.discountPct)}%`);
      if (!PRODUCT_TYPES.includes(i.type)) sub.push('+ IVA si requiere factura');
      const rowH = Math.max(foto ? 52 : 0, hName + hMeta, sub.length ? 26 : 14) + 14;
      asegurar(rowH);
      const top = y + 7;
      if (foto) {
        doc.save();
        doc.roundedRect(M, top, 50, 50, 8).fillAndStroke('#ffffff', C.linea);
        doc.roundedRect(M + 1, top + 1, 48, 48, 7).clip();
        doc.image(foto, M + 3, top + 3, { fit: [44, 44], align: 'center', valign: 'center' });
        doc.restore();
      }
      font('b', 10.5).text(i.name, tx, top, { width: tw });
      if (meta) font('r', 8.5, C.gris).text(meta, tx, doc.y + 2, { width: tw });
      const px = W - M - 130;
      font('b', 11.5).text(pesos(i.total), px, top, { width: 130, align: 'right', lineBreak: false });
      if (sub.length) font('r', 8, C.gris).text(sub.join(' · '), px - 60, top + 15, { width: 190, align: 'right', lineBreak: false });
      y += rowH;
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(C.linea).stroke();
    };

    const comparativa = q.mode === 'COMPARATIVA' && q.groups.length > 1;
    for (const g of q.groups) {
      if (comparativa) {
        asegurar(60);
        doc.roundedRect(M, y, CW, 40, 10).fill(C.fondo);
        const label = g.label.toUpperCase();
        font('b', 8.5, '#ffffff');
        const lw = doc.widthOfString(label, { characterSpacing: 1.2 }) + 20;
        doc.roundedRect(M + 10, y + 11, lw, 18, 9).fill(C.rojo);
        font('b', 8.5, '#ffffff').text(label, M + 20, y + 16, { characterSpacing: 1.2, lineBreak: false });
        etiqueta('Precio final', W - M - 250, y + 9, C.gris, { width: 120, align: 'right' });
        font('x', 16).text(pesos(g.total), W - M - 210, y + 12, { width: 200, align: 'right', lineBreak: false });
        y += 42;
      }
      for (const i of g.items) filaItem(i);
      y += comparativa ? 10 : 0;
    }

    if (!comparativa) {
      const total = q.groups.reduce((a, g) => a + g.total, 0);
      asegurar(76);
      y += 14;
      doc.roundedRect(M, y, CW, 58, 14).fill(C.marino);
      etiqueta('Total', M + 18, y + 15, C.celeste);
      const hayProductos = q.groups.some((g) => g.items.some((i) => PRODUCT_TYPES.includes(i.type)));
      const hayMO = q.groups.some((g) => g.items.some((i) => !PRODUCT_TYPES.includes(i.type)));
      font('r', 9, C.celeste).text(hayProductos ? (hayMO ? 'Equipos con IVA incluido · mano de obra sin IVA' : 'Precio final, IVA incluido') : 'Si requiere factura, se suma el IVA', M + 18, y + 30, { width: CW / 2, lineBreak: false });
      font('x', 24, '#ffffff').text(pesos(total), M + CW / 2 - 18, y + 16, { width: CW / 2, align: 'right', lineBreak: false });
      y += 58;
    }
    y += 18;

    // ---------------------------------------------------------- se incluye
    if (q.seIncluye.length) {
      asegurar(40);
      etiqueta('Se incluye', M, y, C.azul);
      y += 16;
      const colW = CW / 2 - 8;
      for (let n = 0; n < q.seIncluye.length; n += 2) {
        font('r', 10);
        const par = q.seIncluye.slice(n, n + 2);
        const h = Math.max(...par.map((t) => doc.heightOfString(t, { width: colW - 20 }))) + 7;
        asegurar(h);
        par.forEach((t, k) => {
          const x = M + k * (colW + 16);
          doc.save();
          doc.circle(x + 6, y + 6, 6).fill('#E6EEFB');
          doc.moveTo(x + 3.2, y + 6.2).lineTo(x + 5.3, y + 8.3).lineTo(x + 9, y + 4).lineWidth(1.4).strokeColor(C.azul).stroke();
          doc.restore();
          font('r', 10).text(t, x + 18, y + 0.5, { width: colW - 20 });
        });
        y += h;
      }
      y += 12;
    }

    // ---------------------------------------------------------- aclaraciones
    const notas = [...q.notes];
    if (q.usesDollar && q.dollarSell) {
      notas.push(`Los equipos cotizados en dólares se pasaron a pesos con el dólar BNA venta de ${pesos(q.dollarSell)}${q.dollarAt ? ` del ${fechaCorta(new Date(q.dollarAt))}` : ''}.`);
    }
    if (notas.length) {
      asegurar(36);
      etiqueta('Aclaraciones', M, y, C.azul);
      y += 15;
      for (const t of notas) {
        font('r', 9);
        const h = doc.heightOfString(t, { width: CW - 12 }) + 4;
        asegurar(h);
        doc.circle(M + 2.5, y + 5, 1.6).fill(C.rojo);
        font('r', 9, C.gris).text(t, M + 12, y, { width: CW - 12 });
        y += h;
      }
      y += 10;
    }

    if (q.observations) {
      font('r', 9.5);
      const h = doc.heightOfString(q.observations, { width: CW }) + 20;
      asegurar(h);
      etiqueta('Observaciones', M, y, C.azul);
      font('r', 9.5).text(q.observations, M, y + 15, { width: CW });
      y = doc.y + 10;
    }

    // ---------------------------------------------------------- contacto y marcas (al pie de la última página)
    const logos = this.marcas(empresa.marcas);
    const bandH = logos.length ? 112 : 66;
    const limite = H - 58; // justo arriba del pie
    if (y + bandH + 4 > limite) {
      doc.addPage();
      y = encabezado(false);
    }
    const by = Math.max(y + 4, limite - bandH);
    doc.roundedRect(M, by, CW, bandH, 14).fill(C.marino);
    const contactos = [
      { icono: ICONOS.chat, color: '#25D366', etiqueta: 'WhatsApp', valor: empresa.telefono, url: empresa.whatsapp ? `https://wa.me/${empresa.whatsapp.replace(/\D/g, '')}` : '' },
      { icono: ICONOS.camara, color: C.rojo, etiqueta: 'Instagram', valor: empresa.instagram ? `@${empresa.instagram.replace(/^@/, '')}` : '', url: empresa.instagram ? `https://instagram.com/${empresa.instagram.replace(/^@/, '')}` : '' },
      { icono: ICONOS.globo, color: C.azul, etiqueta: 'Web', valor: empresa.web, url: empresa.web ? `https://${empresa.web.replace(/^https?:\/\//, '')}` : '' },
    ].filter((x) => x.valor);
    const colW = (CW - 36) / Math.max(contactos.length, 1);
    contactos.forEach((k, i) => {
      const x = M + 18 + i * colW;
      const cy = by + 15;
      doc.circle(x + 15, cy + 15, 15).fill(k.color);
      doc.save();
      doc.translate(x + 15 - 9, cy + 15 - 9).scale(18 / 24);
      doc.path(k.icono).lineWidth(2).lineCap('round').lineJoin('round').stroke('#ffffff');
      doc.restore();
      etiqueta(k.etiqueta, x + 38, cy + 3, C.celeste);
      const ancho = colW - 42;
      let size = 12;
      while (size > 8.5 && font('b', size).widthOfString(k.valor) > ancho) size -= 0.5;
      font('b', size, '#ffffff').text(k.valor, x + 38, cy + 14, { width: ancho + 4, lineBreak: false });
      if (k.url) doc.link(x, cy, colW - 6, 30, k.url);
    });
    if (logos.length) {
      const ly = by + 55;
      doc.moveTo(M + 18, ly).lineTo(W - M - 18, ly).lineWidth(0.6).strokeColor('#1C2C52').stroke();
      etiqueta('Marcas con las que trabajamos', M + 18, ly + 10, C.celeste);
      const gap = 18;
      const inner = CW - 36;
      const h = Math.min(18, (inner - gap * (logos.length - 1)) / logos.reduce((a, l) => a + l.ratio, 0));
      const total = logos.reduce((a, l) => a + l.ratio * h, 0) + gap * (logos.length - 1);
      let lx = M + 18 + (inner - total) / 2;
      for (const l of logos) {
        doc.image(l.buf, lx, ly + 25 + (18 - h) / 2, { height: h });
        lx += l.ratio * h + gap;
      }
    }

    // ---------------------------------------------------------- pie en todas las páginas
    const range = doc.bufferedPageRange();
    const contacto = [empresa.nombre, [empresa.direccion, empresa.localidad].filter(Boolean).join(', '), `WhatsApp ${empresa.telefono}`, empresa.web]
      .filter(Boolean)
      .join(' · ');
    const zonas = empresa.zonas.length ? `${ajustes.pie ? `${ajustes.pie} · ` : ''}Trabajamos en ${empresa.zonas.join(', ')}.` : ajustes.pie;
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const fy = H - 52;
      doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.6).strokeColor(C.linea).stroke();
      font('s', 8, C.texto).text(contacto, M, fy + 9, { width: CW - 40, lineBreak: false, ellipsis: true });
      if (zonas) font('r', 7.5, C.gris).text(zonas, M, fy + 21, { width: CW - 40, lineBreak: false, ellipsis: true });
      font('r', 7.5, C.gris).text(`${p - range.start + 1}/${range.count}`, W - M - 40, fy + 9, { width: 40, align: 'right', lineBreak: false });
    }
    doc.end();
    return done;
  }
}
