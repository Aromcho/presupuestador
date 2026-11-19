/** Íconos de trazo (los mismos de gesetecalderas.com + los del panel). */
const trazos = {
  abajo: (<><path d="m6 9 6 6 6-6"/></>),
  ajustes: (<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>),
  atras: (<><path d="M20 12H5m6-6-6 6 6 6"/></>),
  bajar: (<><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></>),
  base: (<><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></>),
  basura: (<><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></>),
  buscar: (<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></>),
  caja: (<><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></>),
  caldera_pie: (<><rect x="5.5" y="3.5" width="13" height="17" rx="1.5"/><path d="M5.5 8h13M9 5.8h.01M15 13.5h-3"/></>),
  calendario: (<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4m8-4v4"/></>),
  camion: (<><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></>),
  campana: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></>),
  cerrar: (<><path d="M6 6l12 12M18 6 6 18"/></>),
  check: (<><path d="m5 12.5 4.2 4.2L19 7"/></>),
  clientes: (<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></>),
  columnas: (<><rect x="3.5" y="4.5" width="7" height="15" rx="1.5"/><rect x="13.5" y="4.5" width="7" height="15" rx="1.5"/></>),
  copiar: (<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></>),
  doc: (<><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></>),
  dolar: (<><path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.6 9 2.4 9 7 0 2-2 3.3-4.5 3.3s-4.5-1.1-4.5-3"/></>),
  empresa: (<><path d="M4 20.5V5.5l8-2.5v17.5M12 8.5l8 2.5v9.5M2.5 20.5h19M7 8.5h2M7 12h2M7 15.5h2M15 13h2M15 16.5h2"/></>),
  escudo: (<><path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/></>),
  etiqueta: (<><path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.4"/></>),
  excel: (<><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5"/></>),
  flecha: (<><path d="M4 12h15m-6-6 6 6-6 6"/></>),
  foto: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8.5 8.5"/></>),
  globo: (<><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z"/></>),
  grafico: (<><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></>),
  historial: (<><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/></>),
  inicio: (<><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/></>),
  instalacion: (<><rect x="6" y="3" width="12" height="15" rx="2"/><path d="M9 7h6M9 10.5h3M9 21v-3m6 3v-3"/><circle cx="14.5" cy="13.5" r="1.3"/></>),
  lapiz: (<><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></>),
  llama: (<><path d="M12 2.5c1.2 3.4 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.3-5.1.1 2.2 1 3.3 2.3 3.6-.4-3.4.1-6.4.9-9.5z"/></>),
  llave: (<><path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6 12.6 21a2.1 2.1 0 0 1-3-3l8.4-8.4-1.3-1.3M14.7 6.3 17 4a5 5 0 0 0-6.8 6.6L3.6 17.2a2.1 2.1 0 0 0 3 3l6.6-6.6"/></>),
  mail: (<><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></>),
  mantenimiento: (<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4m8-4v4M8.5 14.5l2.2 2.2 4.8-4.7"/></>),
  megafono: (<><path d="M3.5 10v4h3.5l8.5 4.5v-13L7 10z"/><path d="M18.5 9a4 4 0 0 1 0 6M7.5 14.5 9 20h2.5l-1-5"/></>),
  mas: (<><path d="M12 5v14M5 12h14"/></>),
  menu: (<><path d="M4 7h16M4 12h16M4 17h10"/></>),
  notas: (<><path d="M5 4h14v16H5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></>),
  ojo: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></>),
  piscina: (<><path d="M2.5 16c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.1 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.1-1.2M2.5 20c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.1 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.1-1.2"/><path d="M8 13V5.5a2 2 0 0 1 4 0M16 13V5.5a2 2 0 0 0-4 0M8 9h8"/></>),
  plantilla: (<><path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5M3 16l9 4.5 9-4.5"/></>),
  porcentaje: (<><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></>),
  puntos: (<><path d="M5 12h.01M12 12h.01M19 12h.01"/></>),
  radiador: (<><path d="M5 6.5v11M9 5v14m4-14v14m4-14v14m2-12.5v11"/><path d="M3 8.5h18M3 15.5h18"/></>),
  recargar: (<><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/></>),
  recibo: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></>),
  reloj: (<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>),
  salir: (<><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 16.5 14.5 12 10 7.5M14.5 12H4"/></>),
  subir: (<><path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></>),
  suma: (<><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M8 12h8M12 8v8"/></>),
  telefono: (<><path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11.5 11.5 0 0 0 5.2 5.2l1.4-2.1 4.2 1.6V17a2.5 2.5 0 0 1-2.7 2.5C9.5 19 5 14.5 4.5 6.2A2.5 2.5 0 0 1 5 3.5Z"/></>),
  temporada: (<><path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/><path d="M12 12.5v5m-2.2-3.7 4.4 2.4m0-2.4-4.4 2.4"/></>),
  ubicacion: (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/></>),
  usuario: (<><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></>),
} as const;

export type IconoNombre = keyof typeof trazos | 'whatsapp';

export function Icono({ nombre, className = 'size-5', titulo }: { nombre: IconoNombre; className?: string; titulo?: string }) {
  const comun = {
    className,
    viewBox: '0 0 24 24',
    'aria-hidden': titulo ? undefined : true,
    role: titulo ? 'img' : undefined,
    'aria-label': titulo,
    focusable: 'false' as const,
  };
  if (nombre === 'whatsapp')
    return (
      <svg {...comun} fill="currentColor">
        <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2c0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.3Z"/>
      </svg>
    );
  return (
    <svg {...comun} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {trazos[nombre]}
    </svg>
  );
}
