// Motor de relevos de costaleros. Lógica pura: sin DOM ni estado global.
// Port fiel de la lógica del simulador (simulador-relevos.html).

export type Rol = 'pi' | 'pd' | 'fi' | 'fd' | 'co';
export type Estado = 'dentro' | 'fuera';

export const ROLES: Rol[] = ['pi', 'pd', 'fi', 'fd', 'co'];
const POS: Rol[] = ['pi', 'pd', 'fi', 'fd', 'co'];
const LV: Record<Rol, number> = { pi: 3, pd: 3, fi: 2, fd: 2, co: 1 };

export interface Costalero { id: string; t: number; k: number; rol: Rol; nombre: string }
export interface Fijacion { id: string; nombre: string; tramo: number; estado: Estado }
export interface Celda { na?: 1; dentro: string[]; fuera: string[]; pos: Record<string, Rol> | null }
export type Plan = Celda[][]; // plan[tramo][trabajadera - 1]
export interface Bloqueo { sig: string; rows: { fuera: string[]; pos: Record<string, Rol> | null }[] }

export interface Config {
  deb: number;     // costaleros debajo del paso (5)
  max: number;     // máximo de relevos seguidos fuera
  r7: boolean;     // regla del primer y último tramo
  rol: boolean;    // cubrir los 5 puestos con la jerarquía de alturas
  minB: number;    // mínimo de boquillas debajo a la vez
  tr: number;      // tramos por defecto
}

export interface Entrada {
  config: Config;
  sizes: number[];                  // costaleros por trabajadera
  ov?: Record<number, number>;      // tramos propios de cada trabajadera
  roles?: Record<string, Rol>;      // rol elegido por costalero
  nombres?: Record<string, string>; // nombre elegido por costalero
  boquillas?: string[];             // ids de los boquillas
  momentos?: Record<number, number[]>;
  bloqueos?: Record<number, Bloqueo>;
  fijaciones?: Fijacion[];
  seed: number;
}

export interface Resultado { plan?: Plan; errores: string[]; seed?: number; error?: string }

// ---------- utilidades ----------

export function mulberry(a0: number): () => number {
  let a = a0 | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

// Contexto ya resuelto: todo lo que el motor necesita, sin globales.
class Ctx {
  cfg: Config;
  sizes: number[];
  ov: Record<number, number>;
  roles: Record<string, Rol>;
  nombres: Record<string, string>;
  boq: Set<string>;
  mom: Record<number, number[]>;
  bloqueos: Record<number, Bloqueo>;
  fijaciones: Fijacion[];
  seed: number;
  cs: Costalero[];

  constructor(e: Entrada) {
    this.cfg = e.config;
    this.sizes = e.sizes;
    this.ov = e.ov ?? {};
    this.roles = e.roles ?? {};
    this.nombres = e.nombres ?? {};
    this.boq = new Set(e.boquillas ?? []);
    this.mom = e.momentos ?? {};
    this.bloqueos = e.bloqueos ?? {};
    this.fijaciones = e.fijaciones ?? [];
    this.seed = e.seed;
    this.cs = [];
    this.sizes.forEach((n, i) => {
      for (let k = 1; k <= n; k++) {
        const id = `${i + 1}.${k}`;
        this.cs.push({
          id, t: i + 1, k,
          rol: this.roles[id] ?? ROLES[(k - 1) % 5],
          nombre: (this.nombres[id] ?? '').trim() || `C${k}`,
        });
      }
    });
  }

  tof(t: number): number { return this.ov[t] || this.cfg.tr; }
  maxT(): number { return Math.max(...this.sizes.map((_, i) => this.tof(i + 1))); }
  ofT(t: number): Costalero[] { return this.cs.filter((x) => x.t === t); }

  momOk(t: number, m: number[] | undefined): boolean {
    const T = this.tof(t), M = this.maxT();
    return Array.isArray(m) && m.length === T &&
      m.every((v, i) => Number.isInteger(v) && v >= 1 && v <= M && (i === 0 || v > m[i - 1]));
  }
  slotsDef(t: number): number[] {
    const T = this.tof(t), M = this.maxT();
    return Array.from({ length: T }, (_, i) => Math.floor((i * M) / T) + 1);
  }
  slotsOf(t: number): number[] {
    const m = this.mom[t];
    if (this.momOk(t, m)) return [1, ...m!.slice(1)];
    return this.slotsDef(t);
  }
  sigOf(t: number): string {
    return JSON.stringify([this.tof(t), this.ofT(t).map((x) => x.id + x.rol)]);
  }
  lockRow(t: number, r: number, g: Costalero[]) {
    const L = this.bloqueos[t];
    if (!L || L.sig !== this.sigOf(t)) return null;
    const row = L.rows[r];
    if (!row) return null;
    if (row.fuera.some((id) => !g.some((x) => x.id === id))) return null;
    return row;
  }
}

// ---------- jerarquía de alturas ----------

function outLevels(ctx: Ctx, g: Costalero[], ob: Set<string>, idf: Set<string>,
  w: string, st: Map<string, { f: number; fs: number; ds: number }>, rnd: () => number, t: number): string[] {
  const nF = g.length - 5;
  const n1 = g.filter((x) => LV[x.rol] === 1).length;
  const n3 = g.filter((x) => LV[x.rol] === 3).length;
  const m1 = Math.max(0, n1 - 3), m3 = Math.max(0, n3 - 4);
  if (g.filter((x) => LV[x.rol] !== 1).length < 2 || g.filter((x) => LV[x.rol] !== 3).length < 1)
    throw new Error(`Trabajadera ${t}: con estos roles no se pueden cubrir los 5 puestos`);
  const out = g.filter((x) => idf.has(x.id));
  const rk = new Map(g.map((x) => [x.id, rnd()] as const));
  const free = g.filter((x) => !ob.has(x.id) && !idf.has(x.id)).sort((a, b) => {
    const A = st.get(a.id)!, B = st.get(b.id)!;
    return A.f - B.f || B.ds - A.ds || rk.get(a.id)! - rk.get(b.id)!;
  });
  for (const [lv, m] of [[1, m1], [3, m3]] as const) {
    let have = out.filter((x) => LV[x.rol] === lv).length;
    for (const x of free) {
      if (have >= m) break;
      if (LV[x.rol] === lv && !out.includes(x)) { out.push(x); have++; }
    }
    if (have < m) throw new Error(`${w}: no se pueden respetar los niveles de altura`);
  }
  for (const x of free) { if (out.length >= nF) break; if (!out.includes(x)) out.push(x); }
  if (out.length !== nF) throw new Error(`${w}: no se puede completar el relevo con las reglas de altura`);
  return out.map((x) => x.id);
}

function asignar(g: Costalero[], dentro: string[], w: string, t: number, rnd: () => number): Record<string, Rol> {
  const m = g.filter((x) => dentro.includes(x.id));
  const best: { c: number; p: Rol[] | null } = { c: 1e9, p: null };
  const used = [0, 0, 0, 0, 0];
  const cur: Rol[] = [];
  const go = (i: number, cost: number) => {
    if (cost > best.c) return;
    if (i === m.length) {
      if (cost < best.c || (cost === best.c && rnd() < 0.3)) { best.c = cost; best.p = cur.slice(); }
      return;
    }
    for (let j = 0; j < 5; j++) {
      if (used[j]) continue;
      const L = LV[m[i].rol], P = LV[POS[j]];
      if ((L === 1 && P === 3) || (L === 3 && P === 1)) continue;
      const k = m[i].rol === POS[j] ? 0 : L === P ? 1 : 2;
      used[j] = 1; cur[i] = POS[j];
      go(i + 1, cost + k);
      used[j] = 0;
    }
  };
  go(0, 0);
  if (!best.p) throw new Error(`${w}: no se pueden asignar los puestos con las reglas de altura`);
  const o: Record<string, Rol> = {};
  m.forEach((x, i) => { o[x.id] = best.p![i]; });
  return o;
}

// ---------- generador ----------

function gen(ctx: Ctx): Plan {
  const c = ctx.cfg, cs = ctx.cs, seed = ctx.seed;
  const rnd0 = mulberry(seed);
  const pins = new Map<string, Estado>();
  for (const f of ctx.fijaciones) {
    const x = cs.find((y) => y.id === f.id);
    if (!x) continue;
    if (f.tramo < 1 || f.tramo > ctx.tof(x.t)) continue;
    const k = `${f.tramo}:${f.id}`, p = pins.get(k);
    if (p && p !== f.estado) throw new Error(`Fijación contradictoria: ${x.nombre} en tramo ${f.tramo}`);
    pins.set(k, f.estado);
  }
  const st = new Map<string, { f: number; fs: number; ds: number }>(cs.map((x) => [x.id, { f: 0, fs: 0, ds: 0 }]));
  const cur = new Map<string, string>();
  const MX = ctx.maxT();
  const plan: Plan = Array.from({ length: MX }, () =>
    Array.from({ length: ctx.sizes.length }, () => ({ na: 1 as const, dentro: [], fuera: [], pos: null })));
  const SL = Array.from({ length: ctx.sizes.length }, (_, i) => ctx.slotsOf(i + 1));
  const totB = cs.filter((x) => ctx.boq.has(x.id)).length;
  const RT = new Map<number, () => number>();
  for (let k = 1; k <= MX; k++) {
    const ord = Array.from({ length: ctx.sizes.length }, (_, i) => [rnd0(), i + 1] as const)
      .sort((a, b) => a[0] - b[0]).map((a) => a[1]);
    for (const t of ord) {
      const r = SL[t - 1].indexOf(k);
      if (r < 0) continue;
      if (!RT.has(t)) RT.set(t, mulberry(seed * 7919 + t * 104729));
      const rnd = RT.get(t)!;
      const g = cs.filter((x) => x.t === t), nF = g.length - c.deb, w = `Trabajadera ${t}, tramo ${r + 1}`;
      const LK = ctx.lockRow(t, r, g);
      if (LK) {
        const fz = LK.fuera.slice();
        const dz = g.filter((x) => !fz.includes(x.id)).map((x) => x.id);
        for (const x of g) {
          const s = st.get(x.id)!;
          if (fz.includes(x.id)) { s.f++; s.fs++; s.ds = 0; cur.set(x.id, 'fuera'); }
          else { s.fs = 0; s.ds++; cur.set(x.id, 'dentro'); }
        }
        plan[r][t - 1] = { dentro: dz, fuera: fz, pos: LK.pos ? { ...LK.pos } : null };
        continue;
      }
      if (nF < 0) throw new Error(`Trabajadera ${t}: ${g.length} costaleros, mínimo ${c.deb}`);
      const pin = (x: Costalero) => pins.get(`${r + 1}:${x.id}`);
      const fd = g.filter((x) => pin(x) === 'dentro'), ff = g.filter((x) => pin(x) === 'fuera');
      if (fd.length > c.deb) throw new Error(`${w}: ${fd.length} fijados dentro, máximo ${c.deb}`);
      if (ff.length > nF) throw new Error(`${w}: ${ff.length} fijados fuera, máximo ${nF}`);
      for (const x of ff)
        if (st.get(x.id)!.fs >= c.max)
          throw new Error(`${w}: ${x.nombre} superaría ${c.max} relevos seguidos fuera`);
      const ob = new Set(fd.map((x) => x.id));
      for (const x of g) if (st.get(x.id)!.fs >= c.max) ob.add(x.id);
      const idf = new Set(ff.map((x) => x.id));
      if (c.r7 && r === ctx.tof(t) - 1 && ctx.tof(t) > 1) {
        const p0 = plan[0][t - 1].fuera;
        for (const x of ff)
          if (p0.includes(x.id))
            throw new Error(`${w}: ${x.nombre} salió fuera en el primer tramo y no puede repetir fuera en el último`);
        for (const id of p0) ob.add(id);
      }
      if (c.minB > 0 && totB > 0) {
        const bt = g.filter((x) => ctx.boq.has(x.id));
        if (bt.length) {
          const min = Math.min(c.minB, totB);
          const otros = cs.filter((x) => ctx.boq.has(x.id) && x.t !== t && cur.get(x.id) !== 'fuera').length;
          const need = Math.max(0, min - otros);
          let have = bt.filter((x) => ob.has(x.id)).length;
          if (have < need) {
            const pool = bt.filter((x) => !ob.has(x.id) && !idf.has(x.id));
            const rb = new Map(pool.map((x) => [x.id, rnd()] as const));
            pool.sort((a, b) => {
              const A = st.get(a.id)!, B = st.get(b.id)!;
              return B.f - A.f || B.fs - A.fs || rb.get(a.id)! - rb.get(b.id)!;
            });
            for (const x of pool) { if (have >= need) break; ob.add(x.id); have++; }
            if (have < need) throw new Error(`${w}: no se puede dejar un boquilla debajo del paso en el momento ${k}`);
          }
        }
      }
      const cand = g.filter((x) => !ob.has(x.id) && !idf.has(x.id));
      const falta = nF - ff.length;
      if (cand.length < falta)
        throw new Error(`${w}: las fijaciones, los boquillas y la regla de fuera seguidos impiden completar los relevos`);
      const rk = new Map(cand.map((x) => [x.id, rnd()] as const));
      cand.sort((a, b) => {
        const A = st.get(a.id)!, B = st.get(b.id)!;
        return A.f - B.f || B.ds - A.ds || rk.get(a.id)! - rk.get(b.id)!;
      });
      const fuera = c.rol
        ? outLevels(ctx, g, ob, idf, w, st, rnd, t)
        : [...ff.map((x) => x.id), ...cand.slice(0, falta).map((x) => x.id)];
      const dentro = g.filter((x) => !fuera.includes(x.id)).map((x) => x.id);
      for (const x of g) {
        const s = st.get(x.id)!;
        if (fuera.includes(x.id)) { s.f++; s.fs++; s.ds = 0; cur.set(x.id, 'fuera'); }
        else { s.fs = 0; s.ds++; cur.set(x.id, 'dentro'); }
      }
      plan[r][t - 1] = { dentro, fuera, pos: c.rol ? asignar(g, dentro, w, t, rnd) : null };
    }
  }
  return plan;
}

// ---------- validación y puntuación ----------

function valB(ctx: Ctx, plan: Plan): string[] {
  const e: string[] = [];
  const B = ctx.cs.filter((x) => ctx.boq.has(x.id));
  if (!ctx.cfg.minB || !B.length) return e;
  const M = ctx.maxT(), min = Math.min(ctx.cfg.minB, B.length);
  for (let k = 1; k <= M; k++) {
    let dentro = 0;
    for (const x of B) {
      let r = 0;
      ctx.slotsOf(x.t).forEach((s, i) => { if (s <= k) r = i; });
      if (!plan[r][x.t - 1].fuera.includes(x.id)) dentro++;
    }
    if (dentro < min) e.push(`R9: en el momento ${k} hay solo ${dentro} boquilla(s) debajo (mínimo ${min})`);
  }
  return e;
}

export function validar(ctx: Ctx, plan: Plan): string[] {
  const c = ctx.cfg, cs = ctx.cs, e: string[] = [];
  const fx = new Set(ctx.fijaciones.map((f) => f.id));
  if (c.minB > 0) cs.filter((x) => ctx.boq.has(x.id)).forEach((x) => fx.add(x.id));
  plan.forEach((fila, r) => fila.forEach((x, i) => {
    if (!x.na && c.rol && (!x.pos || new Set(Object.values(x.pos)).size !== 5 ||
      Object.keys(x.pos).some((id) => {
        const L = LV[cs.find((y) => y.id === id)!.rol], P = LV[x.pos![id]];
        return (L === 1 && P === 3) || (L === 3 && P === 1);
      })))
      e.push(`R8: tramo ${r + 1}, trabajadera ${i + 1}: puestos mal cubiertos`);
    if (!x.na && x.dentro.length !== c.deb)
      e.push(`R1: tramo ${r + 1}, trabajadera ${i + 1}: ${x.dentro.length} debajo`);
  }));
  for (let t = 1; t <= ctx.sizes.length; t++) {
    const g = cs.filter((x) => x.t === t);
    g.forEach((x) => {
      let n = 0;
      plan.forEach((fila, r) => {
        n = fila[t - 1].fuera.includes(x.id) ? n + 1 : 0;
        if (n > c.max) e.push(`R3: ${x.nombre} (T${t}) ${n} seguidos fuera, tramo ${r + 1}`);
      });
    });
    const s = g.filter((x) => !fx.has(x.id)).map((x) => plan.filter((f) => f[t - 1].fuera.includes(x.id)).length);
    const exacto = s.length === g.length && (ctx.tof(t) * (g.length - c.deb)) % g.length === 0;
    if (s.length && Math.max(...s) - Math.min(...s) > (exacto ? 0 : 1))
      e.push(`R4: trabajadera ${t} desigual (${s.join(',')})`);
  }
  for (const f of ctx.fijaciones) {
    const x = cs.find((y) => y.id === f.id);
    if (!x || f.tramo < 1 || f.tramo > ctx.tof(x.t)) continue;
    const cel = plan[f.tramo - 1][x.t - 1];
    if (!(f.estado === 'fuera' ? cel.fuera : cel.dentro).includes(f.id))
      e.push(`R6: ${x.nombre} no está ${f.estado} en tramo ${f.tramo}`);
  }
  if (c.r7)
    for (let t = 1; t <= ctx.sizes.length; t++) {
      if (ctx.tof(t) < 2) continue;
      const a = plan[0][t - 1].fuera, b = plan[ctx.tof(t) - 1][t - 1].fuera;
      a.filter((id) => b.includes(id)).forEach((id) =>
        e.push(`R7: ${cs.find((y) => y.id === id)!.nombre} (T${t}) sale fuera en el primer y el último tramo`));
    }
  return e;
}

export function puntuar(ctx: Ctx, p: Plan): number {
  const c = ctx.cfg, cs = ctx.cs;
  let sc = 0;
  const M = ctx.maxT();
  for (const x of cs) {
    const T = ctx.tof(x.t);
    let run = 0;
    for (let r = 0; r < T; r++) {
      const cel = p[r][x.t - 1];
      if (c.rol && cel.pos && cel.pos[x.id] && cel.pos[x.id] !== x.rol) sc += 2;
      if (cel.fuera.includes(x.id)) run++;
      else { if (run === 2) sc += 1; run = 0; }
    }
    if (run === 2) sc += 1;
  }
  for (let t = 1; t <= ctx.sizes.length; t++) {
    const g = cs.filter((y) => y.t === t);
    const n = g.map((x) => {
      let k = 0;
      for (let r = 0; r < ctx.tof(t); r++) if (p[r][t - 1].fuera.includes(x.id)) k++;
      return k;
    });
    if (n.length) sc += 3 * (Math.max(...n) - Math.min(...n));
  }
  for (let k = 1; k <= M; k++) {
    let o = 0;
    for (const x of cs) {
      if (!ctx.boq.has(x.id)) continue;
      let r = 0;
      ctx.slotsOf(x.t).forEach((s, i) => { if (s <= k) r = i; });
      if (p[r][x.t - 1].fuera.includes(x.id)) o++;
    }
    if (o >= 2) sc += 5;
  }
  return sc;
}

// ---------- búsqueda del mejor reparto ----------

export function resolver(e: Entrada): Resultado {
  const ctx = new Ctx(e);
  let best: { p?: Plan; e?: string[]; seed?: number; err?: string } | null = null;
  let bestS: number | null = null, nValid = 0;
  const s0 = ctx.seed;
  for (let i = 0; i < 400; i++) {
    try {
      const p = gen(ctx);
      const errs = validar(ctx, p).concat(valB(ctx, p));
      if (!best || !best.p || errs.length < best.e!.length) best = { p, e: errs, seed: ctx.seed };
      if (!errs.length) {
        nValid++;
        const sc = puntuar(ctx, p);
        if (bestS === null || sc < bestS) { bestS = sc; best = { p, e: errs, seed: ctx.seed }; }
        if (nValid >= 150) break;
      }
    } catch (x) {
      if (!best) best = { err: (x as Error).message };
    }
    ctx.seed = (Math.imul(ctx.seed, 1103515245) + 12345) >>> 0 || 1;
  }
  if (best && best.p) return { plan: best.p, errores: best.e!, seed: best.seed };
  ctx.seed = s0;
  return { errores: [], error: best?.err ?? 'sin resultado' };
}

// Firma de una trabajadera: si cambia, un bloqueo guardado deja de valer.
export function firmaBloqueo(e: Entrada, t: number): string {
  const tr = e.config.tr;
  const T = (e.ov ?? {})[t] || tr;
  const roles = e.roles ?? {};
  const ids: string[] = [];
  const n = e.sizes[t - 1] ?? 0;
  for (let k = 1; k <= n; k++) {
    const id = `${t}.${k}`;
    ids.push(id + (roles[id] ?? ROLES[(k - 1) % 5]));
  }
  return JSON.stringify([T, ids]);
}
