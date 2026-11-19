import type { ReactNode } from 'react';

/**
 * Markdown simple para los textos del plan: títulos, párrafos, listas, tablas,
 * **negrita**, `código` y [enlaces](https://…). Arma nodos de React, sin HTML crudo.
 */
export function Markdown({ md }: { md: string }) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  const esInicio = (l: string) => /^#{1,6}\s/.test(l) || l.trim().startsWith('|') || /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l);

  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }

    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const nivel = h[1].length;
      out.push(
        nivel <= 2 ? (
          <h3 key={i} className="titular-medio mt-2 text-xl">
            {enLinea(h[2])}
          </h3>
        ) : (
          <h4 key={i} className="mt-1 font-bold">
            {enLinea(h[2])}
          </h4>
        ),
      );
      i++;
      continue;
    }

    if (l.trim().startsWith('|')) {
      const filas: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const celdas = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        if (!celdas.every((c) => /^:?-{3,}:?$/.test(c))) filas.push(celdas);
        i++;
      }
      const [cab, ...cuerpo] = filas;
      out.push(
        <div key={i} className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-marino-2">
              <tr>
                {cab?.map((c, j) => (
                  <th key={j} className="px-3 py-2.5 font-semibold text-celeste">
                    {enLinea(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cuerpo.map((f, r) => (
                <tr key={r} className="border-t border-linea align-top">
                  {f.map((c, j) => (
                    <td key={j} className={j === 0 ? 'px-3 py-2.5 font-semibold' : 'px-3 py-2.5 text-[#dce4f7]'}>
                      {enLinea(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const ordenada = /^\s*\d+\.\s+/.test(l);
    if (ordenada || /^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      const re = ordenada ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      const Lista = ordenada ? 'ol' : 'ul';
      out.push(
        <Lista key={i} className={`flex flex-col gap-1.5 pl-5 text-[#dce4f7] ${ordenada ? 'list-decimal' : 'list-disc'} marker:text-humo`}>
          {items.map((t, j) => (
            <li key={j} className="pl-1 leading-relaxed">
              {enLinea(t)}
            </li>
          ))}
        </Lista>,
      );
      continue;
    }

    const parrafo: string[] = [];
    while (i < lines.length && lines[i].trim() && !esInicio(lines[i])) {
      parrafo.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={i} className="leading-relaxed text-[#dce4f7]">
        {enLinea(parrafo.join(' '))}
      </p>,
    );
  }
  return <div className="flex flex-col gap-3.5">{out}</div>;
}

function enLinea(t: string): ReactNode[] {
  const limpio = t.replace(/\\([\\`*_[\]()#+\-.!|])/g, '$1');
  return limpio.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g).map((p, k) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
      return (
        <strong key={k} className="font-bold text-white">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
      return (
        <code key={k} className="rounded bg-noche px-1.5 py-0.5 text-[0.9em] text-celeste">
          {p.slice(1, -1)}
        </code>
      );
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link && /^https?:\/\//.test(link[2]))
      return (
        <a key={k} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-info underline decoration-info/40 underline-offset-2 hover:decoration-info">
          {link[1]}
        </a>
      );
    if (link) return <span key={k}>{link[1]}</span>;
    return <span key={k}>{p}</span>;
  });
}
