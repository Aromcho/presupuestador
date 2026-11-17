/** Minúsculas y sin acentos, para buscar ("Climatización" → "climatizacion") */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const slugify = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Parte una búsqueda en palabras: "Peisa  24" → ["peisa", "24"] */
export const tokens = (q: string) => normalize(q).split(' ').filter(Boolean).slice(0, 8);

/** Prefijos de código a excluir de una lista: "PEI, xyz" → ["PEI", "XYZ"] */
export function excludePrefixes(t: string | null | undefined): string[] {
  return (t ?? '').split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
}
