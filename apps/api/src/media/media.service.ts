import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { Database, InjectDb } from '../db/db.module';
import { media } from '../db/schema';

/** Fotos de equipos: se recortan con fondo blanco y se guardan en WebP 480 y 960 px */
@Injectable()
export class MediaService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  private root() {
    return resolve(this.config.get<string>('UPLOADS_DIR') ?? './uploads');
  }

  async saveImage(buffer: Buffer, mime?: string) {
    if (!buffer?.length) throw new BadRequestException('No llegó ninguna imagen.');
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida (JPG, PNG o WebP).');
    }
    const year = String(new Date().getFullYear());
    const dir = join(this.root(), 'media', year);
    await mkdir(dir, { recursive: true });
    const base = randomUUID();
    const variants = { sm: `media/${year}/${base}-480.webp`, md: `media/${year}/${base}-960.webp` };
    const pipe = (w: number) =>
      sharp(buffer).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 82 });
    await pipe(480).toFile(join(this.root(), variants.sm));
    const info = await pipe(960).toFile(join(this.root(), variants.md));
    const [row] = await this.db
      .insert(media)
      .values({ path: variants.md, variants, width: info.width ?? meta.width, height: info.height ?? meta.height, mime: mime ?? 'image/webp', sizeBytes: info.size })
      .returning();
    return row;
  }
}
