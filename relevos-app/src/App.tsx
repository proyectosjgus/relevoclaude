import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cargarActual, guardarActual, ESTADO_INICIAL, aEntrada, type Estado } from './estado';
import {
  VistaCuadrilla, VistaFijar, VistaPaso, VistaPlanes, VistaResultado,
} from './vistas';
import { VistaAcceso, VersionesNube } from './vistas-nube';
import { nubeActiva, supabase } from './lib/supabase';
import * as nube from './lib/nube';
import { resolver } from './lib/engine';
import { VistaCostalero, EnlaceCostaleros } from './vistas-costalero';

type Pestana = 'paso' | 'cuadrilla' | 'fijar' | 'resultado' | 'planes';
type Sync = { tipo: 'local' | 'guardando' | 'ok' | 'error'; texto: string };

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'paso', texto: 'Paso' },
  { id: 'cuadrilla', texto: 'Costaleros' },
  { id: 'fijar', texto: 'Fijar' },
  { id: 'resultado', texto: 'Resultado' },
  { id: 'planes', texto: 'Planes' },
];

export default function App() {
  const [estado, setEstado] = useState<Estado>(() => cargarActual());
  const [pestana, setPestana] = useState<Pestana>('resultado');
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(!nubeActiva);
  const [cuadrilla, setCuadrilla] = useState<nube.Cuadrilla | null>(null);
  const [sync, setSync] = useState<Sync>({ tipo: 'local', texto: nubeActiva ? '' : 'Guardado en este móvil' });
  const [mensaje, setMensaje] = useState('');
  const [refrescoVersiones, setRefrescoVersiones] = useState(0);
  const primeraCarga = useRef(true);
  const codigoCostalero = new URLSearchParams(window.location.search).get('c');

  // Sesión de Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setListo(true); });
    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => suscripcion.subscription.unsubscribe();
  }, []);

  // Al entrar: cuadrilla del capataz y su último borrador de la nube
  useEffect(() => {
    if (!sesion) { setCuadrilla(null); return; }
    let vivo = true;
    (async () => {
      try {
        const c = (await nube.miCuadrilla()) ?? (await nube.crearCuadrilla('Mi cuadrilla'));
        const borrador = await nube.cargarBorrador(c.id);
        if (!vivo) return;
        setCuadrilla(c);
        if (borrador) setEstado({ ...ESTADO_INICIAL, ...borrador });
        setSync({ tipo: 'ok', texto: 'Sincronizado' });
      } catch (e) {
        if (vivo) setSync({ tipo: 'error', texto: 'No se pudo cargar de la nube' });
      }
    })();
    return () => { vivo = false; };
  }, [sesion]);

  // Copia local siempre; copia en la nube con un pequeño retardo tras cada cambio
  useEffect(() => {
    guardarActual(estado);
    if (!cuadrilla) return;
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    setSync({ tipo: 'guardando', texto: 'Guardando…' });
    const t = setTimeout(async () => {
      try {
        await nube.guardarBorrador(cuadrilla.id, estado);
        setSync({ tipo: 'ok', texto: 'Guardado en la nube' });
      } catch {
        setSync({ tipo: 'error', texto: 'Sin conexión: guardado solo en este móvil' });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [estado, cuadrilla]);

  const set = (f: (x: Estado) => Estado) => setEstado((x) => f(x));

  const publicarVersion = async () => {
    if (!cuadrilla) return;
    const r = resolver(aEntrada(estado));
    if (r.error || r.errores.length) {
      setMensaje('Corrige los errores del plan antes de publicar.');
      return;
    }
    if (!window.confirm('¿Publicar esta versión? Los costaleros verán este plan.')) return;
    try {
      if (!r.plan) return;
      await nube.publicar(cuadrilla.id, estado, r.plan);
      setMensaje('Versión publicada.');
      setRefrescoVersiones((n) => n + 1);
    } catch (e) {
      setMensaje((e as Error).message || 'No se pudo publicar.');
    }
  };

  const cerrarSesion = async () => {
    await nube.salir();
    setSesion(null);
  };

  if (codigoCostalero) {
    return nubeActiva ? <VistaCostalero codigo={codigoCostalero} /> : (
      <main className="app"><p className="estado error">Este enlace necesita la nube configurada.</p></main>
    );
  }
  if (!listo) return <main className="app"><p className="ayuda">Cargando…</p></main>;
  if (nubeActiva && !sesion) {
    return (
      <main className="app">
        <header className="cabecera"><h1>Relevos</h1></header>
        <VistaAcceso />
      </main>
    );
  }

  return (
    <main className="app">
      <header className="cabecera">
        <h1>Relevos</h1>
        <span className={`sync ${sync.tipo}`}>{sync.texto}</span>
      </header>
      {nubeActiva && (
        <div className="acciones no-imprimir">
          <button type="button" onClick={publicarVersion} disabled={!cuadrilla}>Publicar versión</button>
          <button type="button" className="sec" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      )}
      {mensaje && <p className="estado">{mensaje}</p>}
      <nav className="menu no-imprimir">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className={pestana === p.id ? 'on' : ''}
            onClick={() => setPestana(p.id)}>{p.texto}</button>
        ))}
      </nav>
      {pestana === 'paso' && <VistaPaso e={estado} set={set} />}
      {pestana === 'cuadrilla' && <VistaCuadrilla e={estado} set={set} />}
      {pestana === 'fijar' && <VistaFijar e={estado} set={set} />}
      {pestana === 'resultado' && <VistaResultado e={estado} set={set} />}
      {pestana === 'planes' && (
        <>
          <VistaPlanes e={estado} set={set} />
          {cuadrilla && <EnlaceCostaleros cuadrilla={cuadrilla} onCambio={setCuadrilla} />}
          {cuadrilla && <VersionesNube cuadrillaId={cuadrilla.id} refresco={refrescoVersiones} />}
        </>
      )}
    </main>
  );
}
