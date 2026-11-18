import type { Bloqueo, Fijacion, Rol } from './lib/engine';
import type { Entrada } from './lib/engine';

export interface Estado {
  sizes: number[];
  tr: number;
  ov: Record<number, number>;
  deb: number;
  max: number;
  r7: boolean;
  rol: boolean;
  minB: number;
  nombres: Record<string, string>;
  roles: Record<string, Rol>;
  boquillas: string[];
  puntos: Record<number, string>;
  momentos: Record<number, number[]>;
  bloqueos: Record<number, Bloqueo>;
  fijaciones: Fijacion[];
  seed: number;
  titulo: string;
  fecha: string;
}

export const ESTADO_INICIAL: Estado = {
  sizes: [6, 7, 8, 9, 10, 8, 7],
  tr: 12,
  ov: {},
  deb: 5,
  max: 2,
  r7: true,
  rol: true,
  minB: 1,
  nombres: {},
  roles: {},
  boquillas: [],
  puntos: {},
  momentos: {},
  bloqueos: {},
  fijaciones: [],
  seed: 1,
  titulo: 'Costaleros',
  fecha: '',
};

export function aEntrada(e: Estado): Entrada {
  return {
    config: { deb: e.deb, max: e.max, r7: e.r7, rol: e.rol && e.deb === 5, minB: e.minB, tr: e.tr },
    sizes: e.sizes,
    ov: e.ov,
    roles: e.roles,
    nombres: e.nombres,
    boquillas: e.boquillas,
    momentos: e.momentos,
    bloqueos: e.bloqueos,
    fijaciones: e.fijaciones,
    seed: e.seed,
  };
}

export const CLAVE_ACTUAL = 'relevos:v2:actual';
const CLAVE_PLANES = 'relevos:v2:planes';

export function cargarActual(): Estado {
  try {
    const raw = localStorage.getItem(CLAVE_ACTUAL);
    if (raw) return { ...ESTADO_INICIAL, ...JSON.parse(raw) } as Estado;
  } catch {
    /* estado corrupto: se empieza de cero */
  }
  return ESTADO_INICIAL;
}

export function guardarActual(e: Estado): void {
  try {
    localStorage.setItem(CLAVE_ACTUAL, JSON.stringify(e));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function cargarPlanes(): Record<string, Estado> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PLANES) || '{}') || {};
  } catch {
    return {};
  }
}

export function guardarPlanes(p: Record<string, Estado>): boolean {
  try {
    localStorage.setItem(CLAVE_PLANES, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export const ROL_TEXTO: Record<Rol, string> = {
  pi: 'Patero izquierdo / costero izquierdo',
  pd: 'Patero derecho / costero derecho',
  fi: 'Fijador izquierdo',
  fd: 'Fijador derecho',
  co: 'Corriente',
};

export const ROL_CORTO: Record<Rol, string> = {
  pi: 'PI',
  pd: 'PD',
  fi: 'FI',
  fd: 'FD',
  co: 'Co',
};
