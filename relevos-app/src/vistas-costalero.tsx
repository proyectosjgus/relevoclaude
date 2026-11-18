import { useCallback, useEffect, useState } from 'react';
import * as nube from './lib/nube';
import { costalerosDe, tof, type Costal } from './vistas';
import { ROL_CORTO } from './estado';
import type { Estado } from './estado';
import type { Plan } from './lib/engine';

const CLAVE_ELECCION = (codigo: string) => `relevos:costalero:${codigo}`;

export function VistaCostalero({ codigo }: { codigo: string }) {
  const [datos, setDatos] = useState<nube.PlanPublicado | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState<string | null>(() => localStorage.getItem(CLAVE_ELECCION(codigo)));

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await nube.planPublicado(codigo));
    } catch {
      setError('Sin conexión. Inténtalo de nuevo cuando tengas cobertura.');
    }
  }, [codigo]);

  useEffect(() => {
    cargar();
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  if (datos === undefined && !error) return <main className="app"><p className="ayuda">Cargando…</p></main>;

  return (
    <main className="app">
      <header className="cabecera"><h1>Mi relevo</h1></header>
      {error && <p className="estado error">{error}</p>}
      {datos === null && (
        <section className="card"><p>Todavía no hay un plan publicado para esta cuadrilla.</p>
          <button type="button" className="sec" onClick={cargar}>Actualizar</button></section>
      )}
      {datos && (
        <Contenido datos={datos} elegido={elegido}
          onElegir={(id) => { localStorage.setItem(CLAVE_ELECCION(codigo), id); setElegido(id); }}
          onOlvidar={() => { localStorage.removeItem(CLAVE_ELECCION(codigo)); setElegido(null); }}
          onActualizar={cargar} />
      )}
    </main>
  );
}

function Contenido({ datos, elegido, onElegir, onOlvidar, onActualizar }: {
  datos: nube.PlanPublicado; elegido: string | null;
  onElegir: (id: string) => void; onOlvidar: () => void; onActualizar: () => void;
}) {
  const { estado, plan, numero, publicada_en } = datos;
  const todos = costalerosDe(estado);
  const yo = elegido ? todos.find((c) => c.id === elegido) : undefined;

  if (!yo) {
    return (
      <section className="card">
        <h2>¿Quién eres?</h2>
        <p className="ayuda">Elige tu nombre. Lo recordaremos en este móvil.</p>
        <div className="lista">
          {todos.map((c) => (
            <button key={c.id} type="button" className="sec" onClick={() => onElegir(c.id)}>
              {c.nombre} · T{c.t}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <Tarjeta estado={estado} plan={plan} yo={yo} numero={numero} fecha={publicada_en} />
      <div className="acciones">
        <button type="button" className="sec" onClick={onActualizar}>Actualizar</button>
        <button type="button" className="sec" onClick={onOlvidar}>No soy yo</button>
      </div>
    </>
  );
}

function Tarjeta({ estado, plan, yo, numero, fecha }: {
  estado: Estado; plan: Plan; yo: Costal; numero: number; fecha: string;
}) {
  const T = tof(estado, yo.t);
  const filas = Array.from({ length: T }, (_, r) => {
    const cel = plan[r][yo.t - 1];
    const fuera = cel.fuera.includes(yo.id);
    const puesto = cel.pos?.[yo.id] ?? yo.rol;
    return { r, fuera, puesto };
  });
  const salidas = filas.filter((f) => f.fuera).map((f) => f.r + 1);
  return (
    <section className="tarjeta">
      <div className="tt">{estado.titulo.toUpperCase()} — TRABAJADERA {yo.t}
        <small>Versión {numero} · {new Date(fecha).toLocaleDateString('es-ES')}</small></div>
      <div className="tnom">{yo.nombre}</div>
      <table className="tabla-t">
        <thead><tr><th>Tramo</th><th>Puesto</th><th>Situación</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.r} className={f.fuera ? 'out' : 'in'}>
              <td>{f.r + 1}{estado.puntos[f.r + 1] ? ` · ${estado.puntos[f.r + 1]}` : ''}</td>
              <td>{f.fuera ? '—' : ROL_CORTO[f.puesto]}</td>
              <td>{f.fuera ? 'Fuera' : 'Debajo'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ayuda">Sales fuera en los tramos: {salidas.length ? salidas.join(', ') : 'ninguno'}</p>
    </section>
  );
}

export function EnlaceCostaleros({ cuadrilla, onCambio }: {
  cuadrilla: nube.Cuadrilla; onCambio: (c: nube.Cuadrilla) => void;
}) {
  const [copiado, setCopiado] = useState('');
  const enlace = `${window.location.origin}${window.location.pathname}?c=${cuadrilla.codigo}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setCopiado('Enlace copiado.'); }
    catch { setCopiado('Copia el enlace de la casilla de abajo.'); }
  };
  const regenerar = async () => {
    if (!window.confirm('El enlace actual dejará de funcionar. ¿Crear uno nuevo?')) return;
    const codigo = await nube.regenerarCodigo();
    onCambio({ ...cuadrilla, codigo });
    setCopiado('Enlace nuevo creado. Compártelo de nuevo con la cuadrilla.');
  };
  return (
    <section className="card">
      <h2>Enlace para los costaleros</h2>
      <p className="ayuda">Mándalo por WhatsApp. Cada costalero elige su nombre y ve su relevo de la última versión publicada.</p>
      <textarea className="copia" readOnly value={enlace} onFocus={(e) => e.target.select()} />
      <div className="acciones">
        <button type="button" onClick={copiar}>Copiar enlace</button>
        <button type="button" className="sec" onClick={regenerar}>Crear enlace nuevo</button>
      </div>
      {copiado && <p className="ayuda">{copiado}</p>}
    </section>
  );
}
