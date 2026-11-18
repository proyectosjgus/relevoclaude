import { useMemo, useRef, useState } from 'react';
import { firmaBloqueo, resolver, ROLES, type Plan, type Rol } from './lib/engine';
import {
  aEntrada, cargarPlanes, guardarPlanes, ROL_CORTO, ROL_TEXTO,
  ESTADO_INICIAL, type Estado,
} from './estado';

export interface Props {
  e: Estado;
  set: (f: (x: Estado) => Estado) => void;
}

export interface Costal {
  id: string;
  t: number;
  k: number;
  rol: Rol;
  nombre: string;
  boquilla: boolean;
}

export const tof = (e: Estado, t: number) => e.ov[t] || e.tr;
export const maxT = (e: Estado) => Math.max(...e.sizes.map((_, i) => tof(e, i + 1)));

export function costalerosDe(e: Estado): Costal[] {
  const out: Costal[] = [];
  e.sizes.forEach((n, i) => {
    for (let k = 1; k <= n; k++) {
      const id = `${i + 1}.${k}`;
      out.push({
        id, t: i + 1, k,
        rol: e.roles[id] ?? ROLES[(k - 1) % 5],
        nombre: (e.nombres[id] ?? '').trim() || `C${k}`,
        boquilla: e.boquillas.includes(id),
      });
    }
  });
  return out;
}

const num = (v: string, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

// ---------- Paso ----------

export function VistaPaso({ e, set }: Props) {
  const nt = e.sizes.length;
  const cambiarTrabajaderas = (v: string) => {
    const n = num(v, 1, 12, nt);
    set((x) => ({
      ...x,
      sizes: n > x.sizes.length
        ? [...x.sizes, ...Array(n - x.sizes.length).fill(8)]
        : x.sizes.slice(0, n),
    }));
  };
  return (
    <section className="card">
      <h2>Paso</h2>
      <div className="fila">
        <label>Trabajaderas<input type="number" min={1} max={12} value={nt}
          onChange={(ev) => cambiarTrabajaderas(ev.target.value)} /></label>
        <label>Tramos (general)<input type="number" min={1} max={40} value={e.tr}
          onChange={(ev) => set((x) => ({ ...x, tr: num(ev.target.value, 1, 40, x.tr) }))} /></label>
        <label>Debajo<input type="number" min={1} max={10} value={e.deb}
          onChange={(ev) => set((x) => ({ ...x, deb: num(ev.target.value, 1, 10, x.deb) }))} /></label>
        <label>Máx. fuera seguidos<input type="number" min={1} max={10} value={e.max}
          onChange={(ev) => set((x) => ({ ...x, max: num(ev.target.value, 1, 10, x.max) }))} /></label>
        <label>Mín. boquillas debajo<input type="number" min={0} max={5} value={e.minB}
          onChange={(ev) => set((x) => ({ ...x, minB: num(ev.target.value, 0, 5, x.minB) }))} /></label>
      </div>
      <label className="check">
        <input type="checkbox" checked={e.r7}
          onChange={(ev) => set((x) => ({ ...x, r7: ev.target.checked }))} />
        Quien sale fuera en el primer tramo no repite fuera en el último
      </label>
      <label className="check">
        <input type="checkbox" checked={e.rol} disabled={e.deb !== 5}
          onChange={(ev) => set((x) => ({ ...x, rol: ev.target.checked }))} />
        Cubrir los 5 puestos con la jerarquía de alturas
      </label>

      <h3>Trabajaderas</h3>
      <div className="lista">
        {e.sizes.map((n, i) => {
          const t = i + 1;
          return (
            <div className="fila fila-t" key={t}>
              <strong>T{t}</strong>
              <label>Costaleros<input type="number" min={0} max={30} value={n}
                onChange={(ev) => {
                  const v = num(ev.target.value, 0, 30, n);
                  set((x) => ({ ...x, sizes: x.sizes.map((s, j) => (j === i ? v : s)) }));
                }} /></label>
              <label>Tramos<select value={e.ov[t] ?? ''}
                onChange={(ev) => set((x) => {
                  const ov = { ...x.ov };
                  if (ev.target.value) ov[t] = Number(ev.target.value); else delete ov[t];
                  return { ...x, ov };
                })}>
                <option value="">General ({e.tr})</option>
                {[2, 4, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select></label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Cuadrilla ----------

export function VistaCuadrilla({ e, set }: Props) {
  const [t, setT] = useState(1);
  const lista = costalerosDe(e).filter((c) => c.t === t);
  const M = maxT(e);
  return (
    <section className="card">
      <h2>Costaleros</h2>
      <label>Trabajadera<select value={t} onChange={(ev) => setT(Number(ev.target.value))}>
        {e.sizes.map((_, i) => <option key={i} value={i + 1}>T{i + 1}</option>)}
      </select></label>
      <div className="lista">
        {lista.map((c) => (
          <div className="fila fila-c" key={c.id}>
            <input type="text" maxLength={24} placeholder={`C${c.k}`} value={e.nombres[c.id] ?? ''}
              onChange={(ev) => set((x) => ({ ...x, nombres: { ...x.nombres, [c.id]: ev.target.value } }))} />
            <select value={c.rol} onChange={(ev) => set((x) => ({ ...x, roles: { ...x.roles, [c.id]: ev.target.value as Rol } }))}>
              {ROLES.map((R) => <option key={R} value={R}>{ROL_TEXTO[R]}</option>)}
            </select>
            <label className="check">
              <input type="checkbox" checked={c.boquilla}
                onChange={(ev) => set((x) => ({
                  ...x,
                  boquillas: ev.target.checked
                    ? [...x.boquillas, c.id]
                    : x.boquillas.filter((b) => b !== c.id),
                }))} />
              Boquilla
            </label>
          </div>
        ))}
      </div>

      <h3>Puntos del recorrido</h3>
      <p className="ayuda">Nombre de cada punto de relevo (1 al {M}). Se usa en las tarjetas.</p>
      <div className="fila puntos">
        {Array.from({ length: M }, (_, i) => (
          <label key={i}>{i + 1}
            <input type="text" maxLength={24} value={e.puntos[i + 1] ?? ''}
              onChange={(ev) => set((x) => ({ ...x, puntos: { ...x.puntos, [i + 1]: ev.target.value } }))} />
          </label>
        ))}
      </div>
    </section>
  );
}

// ---------- Fijar ----------

export function VistaFijar({ e, set }: Props) {
  const [t, setT] = useState(1);
  const lista = costalerosDe(e).filter((c) => c.t === t);
  const T = tof(e, t);
  const estadoDe = (id: string, tramo: number) =>
    e.fijaciones.find((f) => f.id === id && f.tramo === tramo)?.estado;

  const ciclar = (c: Costal, tramo: number) => {
    set((x) => {
      const i = x.fijaciones.findIndex((f) => f.id === c.id && f.tramo === tramo);
      if (i < 0) return { ...x, fijaciones: [...x.fijaciones, { id: c.id, nombre: c.nombre, tramo, estado: 'dentro' }] };
      if (x.fijaciones[i].estado === 'dentro')
        return { ...x, fijaciones: x.fijaciones.map((f, j) => (j === i ? { ...f, estado: 'fuera' } : f)) };
      return { ...x, fijaciones: x.fijaciones.filter((_, j) => j !== i) };
    });
  };

  return (
    <section className="card">
      <h2>Fijar</h2>
      <p className="ayuda">Toca una celda: dentro, luego fuera, luego libre. Se recalcula el reparto.</p>
      <label>Trabajadera<select value={t} onChange={(ev) => setT(Number(ev.target.value))}>
        {e.sizes.map((_, i) => <option key={i} value={i + 1}>T{i + 1}</option>)}
      </select></label>
      <div className="scroll">
        <table className="grilla">
          <thead>
            <tr><th />{Array.from({ length: T }, (_, r) => <th key={r}>{r + 1}</th>)}</tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="nombre">{c.nombre}</td>
                {Array.from({ length: T }, (_, r) => {
                  const est = estadoDe(c.id, r + 1);
                  return (
                    <td key={r}>
                      <button type="button"
                        className={`celda ${est === 'dentro' ? 'dentro' : est === 'fuera' ? 'fuera' : 'libre'}`}
                        onClick={() => ciclar(c, r + 1)}>
                        {est === 'dentro' ? '▲' : est === 'fuera' ? '○' : '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="sec" onClick={() => set((x) => ({ ...x, fijaciones: [] }))}>
        Quitar todas las fijaciones
      </button>
    </section>
  );
}

// ---------- Resultado ----------

export function VistaResultado({ e, set }: Props) {
  const [t, setT] = useState(1);
  const ultimoToque = useRef<{ t: number; at: number }>({ t: 0, at: 0 });
  const resultado = useMemo(() => resolver(aEntrada(e)), [e]);
  const plan: Plan | undefined = resultado.plan;
  const costales = costalerosDe(e).filter((c) => c.t === t);
  const T = tof(e, t);
  const bloqueada = Boolean(e.bloqueos[t]);

  const alternarBloqueo = () => {
    if (e.bloqueos[t]) {
      set((x) => { const b = { ...x.bloqueos }; delete b[t]; return { ...x, bloqueos: b }; });
      return;
    }
    if (!plan) return;
    const rows = Array.from({ length: T }, (_, r) => {
      const cel = plan[r][t - 1];
      return { fuera: cel.fuera.slice(), pos: cel.pos ? { ...cel.pos } : null };
    });
    set((x) => ({ ...x, bloqueos: { ...x.bloqueos, [t]: { sig: firmaBloqueo(aEntrada(x), t), rows } } }));
  };

  const tocarPestana = (n: number) => {
    const ahora = Date.now();
    if (ultimoToque.current.t === n && ahora - ultimoToque.current.at < 450) {
      ultimoToque.current = { t: 0, at: 0 };
      setT(n);
      alternarBloqueo();
      return;
    }
    ultimoToque.current = { t: n, at: ahora };
    setT(n);
  };

  const tocarCelda = (id: string, tramo: number) => {
    const est = e.fijaciones.find((f) => f.id === id && f.tramo === tramo);
    set((x) => {
      const i = x.fijaciones.findIndex((f) => f.id === id && f.tramo === tramo);
      if (i < 0) {
        const c = costalerosDe(x).find((y) => y.id === id);
        return { ...x, fijaciones: [...x.fijaciones, { id, nombre: c?.nombre ?? id, tramo, estado: 'dentro' }] };
      }
      if (est?.estado === 'dentro')
        return { ...x, fijaciones: x.fijaciones.map((f, j) => (j === i ? { ...f, estado: 'fuera' } : f)) };
      return { ...x, fijaciones: x.fijaciones.filter((_, j) => j !== i) };
    });
  };

  return (
    <section className="card">
      <h2>Resultado</h2>
      <div className={`estado ${resultado.plan && resultado.errores.length === 0 ? 'ok' : 'error'}`}>
        {resultado.error
          ? resultado.error
          : resultado.errores.length
            ? resultado.errores.join(' · ')
            : 'Plan válido: se cumplen todas las reglas.'}
      </div>
      <div className="acciones">
        <button type="button" onClick={() => set((x) => ({ ...x, seed: Math.floor(Math.random() * 1e9) }))}>
          Volver a generar
        </button>
        {e.fijaciones.length > 0 && (
          <button type="button" className="sec" onClick={() => set((x) => ({ ...x, fijaciones: [] }))}>
            Quitar fijaciones
          </button>
        )}
        {Object.keys(e.bloqueos).length > 0 && (
          <button type="button" className="sec" onClick={() => set((x) => ({ ...x, bloqueos: {} }))}>
            Desbloquear trabajaderas
          </button>
        )}
        {e.rol && e.deb === 5 && resultado.errores.some((m) => /R8|R4/.test(m)) && (
          <button type="button" className="sec" onClick={() => set((x) => ({ ...x, rol: false }))}>
            Desactivar roles
          </button>
        )}
        {e.r7 && resultado.errores.some((m) => m.includes('primer')) && (
          <button type="button" className="sec" onClick={() => set((x) => ({ ...x, r7: false }))}>
            Desactivar primer y último tramo
          </button>
        )}
      </div>

      <div className="pestanas">
        {e.sizes.map((_, i) => {
          const n = i + 1;
          return (
            <button key={n} type="button" className={`${n === t ? 'on' : ''}`}
              title="Doble toque: fijar patrón"
              onClick={() => tocarPestana(n)}>
              T{n}{e.bloqueos[n] ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>

      <div className="scroll">
        <table className="grilla mat">
          <thead>
            <tr><th />{Array.from({ length: T }, (_, r) => <th key={r}>{r + 1}</th>)}<th>Sal.</th></tr>
          </thead>
          <tbody>
            {costales.map((c) => {
              let salidas = 0;
              return (
                <tr key={c.id}>
                  <td className="nombre">{c.nombre}{c.boquilla ? ' ★' : ''}</td>
                  {Array.from({ length: T }, (_, r) => {
                    const cel = plan?.[r]?.[t - 1];
                    const fuera = cel ? cel.fuera.includes(c.id) : false;
                    if (fuera) salidas++;
                    const fij = e.fijaciones.find((f) => f.id === c.id && f.tramo === r + 1);
                    const puesto = cel?.pos?.[c.id];
                    const cambia = cel && cel.pos && puesto && puesto !== c.rol;
                    return (
                      <td key={r}>
                        <button type="button"
                          className={`celda ${fuera ? 'fuera' : cel ? 'dentro' : 'libre'} ${fij ? 'fijada' : ''} ${cambia ? 'cambia' : ''}`}
                          onClick={() => tocarCelda(c.id, r + 1)}>
                          {!cel ? '·' : fuera ? '○' : puesto ? ROL_CORTO[puesto] : '▲'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="n">{salidas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ayuda">
        {bloqueada ? 'Trabajadera bloqueada: mantiene su patrón al regenerar.' : 'Doble toque en la pestaña para bloquear la trabajadera.'}
        {' '}Subrayado: cubre otro puesto.
      </p>
      {!plan && <p className="ayuda">Sin plan válido: toca las celdas para corregir las fijaciones.</p>}
      <button type="button" className="sec" onClick={() => set((x) => ({ ...x, seed: Math.floor(Math.random() * 1e9) }))}>
        Probar otro reparto
      </button>
      {e.fijaciones.length > 0 && <p className="ayuda">{e.fijaciones.length} fijaciones activas.</p>}
      <Tarjetas e={e} plan={plan} t={t} />
    </section>
  );
}

// ---------- Tarjetas ----------

function Tarjetas({ e, plan, t }: { e: Estado; plan: Plan | undefined; t: number }) {
  const costales = costalerosDe(e).filter((c) => c.t === t);
  const T = tof(e, t);
  if (!plan) return null;
  const nombreDe = (id: string) => costalerosDe(e).find((c) => c.id === id)?.nombre ?? id;
  return (
    <div className="tarjetas">
      <div className="acciones no-imprimir">
        <button type="button" onClick={() => window.print()}>Imprimir / PDF de T{t}</button>
      </div>
      {costales.map((c) => {
        const fuera: number[] = [];
        const rows = Array.from({ length: T }, (_, r) => {
          const cel = plan[r][t - 1];
          const esFuera = cel.fuera.includes(c.id);
          if (esFuera) fuera.push(r + 1);
          const puesto = cel.pos?.[c.id] ?? c.rol;
          return { r, esFuera, puesto };
        });
        return (
          <div className="tarjeta" key={c.id}>
            <div className="tt">{e.titulo.toUpperCase()} — TRABAJADERA {t}<small>{e.fecha || new Date().toLocaleDateString('es-ES')}</small></div>
            <div className="tnom">{c.nombre}</div>
            <table className="tabla-t">
              <thead><tr><th>Tramo</th><th>Puesto</th><th>Situación</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.r} className={row.esFuera ? 'out' : 'in'}>
                    <td>{row.r + 1}{e.puntos[row.r + 1] ? ` · ${e.puntos[row.r + 1]}` : ''}</td>
                    <td>{row.esFuera ? '—' : ROL_CORTO[row.puesto]}</td>
                    <td>{row.esFuera ? 'Fuera' : 'Debajo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ayuda">Sales fuera en los tramos: {fuera.length ? fuera.join(', ') : 'ninguno'}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Planes ----------

export function VistaPlanes({ e, set }: Props) {
  const [planes, setPlanes] = useState<Record<string, Estado>>(() => cargarPlanes());
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [copia, setCopia] = useState('');

  const guardar = () => {
    const n = nombre.trim();
    if (!n) { setMensaje('Escribe un nombre para el plan.'); return; }
    const nuevo = { ...planes, [n]: e };
    if (guardarPlanes(nuevo)) { setPlanes(nuevo); setMensaje(`Plan guardado: ${n}`); }
    else setMensaje('Este navegador no permite guardar. Usa la copia de seguridad.');
  };
  const cargar = (k: string) => { set(() => ({ ...ESTADO_INICIAL, ...planes[k] }));  setNombre(k); setMensaje(`Plan cargado: ${k}`); };
  const borrar = (k: string) => {
    const nuevo = { ...planes };
    delete nuevo[k];
    guardarPlanes(nuevo);
    setPlanes(nuevo);
    setMensaje('Plan borrado.');
  };

  return (
    <section className="card">
      <h2>Planes guardados</h2>
      <div className="fila">
        <label>Nombre<input type="text" maxLength={40} placeholder="Jueves Santo" value={nombre}
          onChange={(ev) => setNombre(ev.target.value)} /></label>
        <button type="button" onClick={guardar}>Guardar plan</button>
      </div>
      {Object.keys(planes).length === 0 && <p className="ayuda">Todavía no hay planes guardados.</p>}
      <div className="lista">
        {Object.keys(planes).sort().map((k) => (
          <div className="fila fila-plan" key={k}>
            <span>{k}</span>
            <button type="button" onClick={() => cargar(k)}>Cargar</button>
            <button type="button" className="sec" onClick={() => borrar(k)}>Borrar</button>
          </div>
        ))}
      </div>
      <h3>Copia de seguridad</h3>
      <div className="fila">
        <button type="button" className="sec" onClick={() => setCopia(JSON.stringify({ actual: e, planes }))}>Generar copia</button>
        <button type="button" className="sec" onClick={() => {
          try {
            const d = JSON.parse(copia) as { actual?: Estado; planes?: Record<string, Estado> };
            if (d.planes) { guardarPlanes({ ...planes, ...d.planes }); setPlanes({ ...planes, ...d.planes }); }
            if (d.actual) set(() => ({ ...ESTADO_INICIAL, ...d.actual }));
            setMensaje('Copia restaurada.');
          } catch { setMensaje('El texto no es una copia válida.'); }
        }}>Restaurar copia</button>
      </div>
      <textarea className="copia" value={copia} onChange={(ev) => setCopia(ev.target.value)}
        placeholder="Aquí aparece la copia. Pégala para restaurarla." />
      {mensaje && <p className="ayuda">{mensaje}</p>}
    </section>
  );
}
