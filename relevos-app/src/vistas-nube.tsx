import { useEffect, useState } from 'react';
import * as nube from './lib/nube';

export function VistaAcceso() {
  const [modo, setModo] = useState<'entrar' | 'registrar'>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enCurso, setEnCurso] = useState(false);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setEnCurso(true);
    try {
      if (modo === 'entrar') await nube.entrar(email.trim(), clave);
      else await nube.registrar(email.trim(), clave);
    } catch (e) {
      setError(mensajeAmigable(e));
    } finally {
      setEnCurso(false);
    }
  };

  return (
    <section className="card acceso">
      <h2>{modo === 'entrar' ? 'Entrar como capataz' : 'Crear cuenta de capataz'}</h2>
      <form onSubmit={enviar} className="lista">
        <label>Correo<input type="email" autoComplete="email" required value={email}
          onChange={(ev) => setEmail(ev.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          required minLength={6} value={clave} onChange={(ev) => setClave(ev.target.value)} /></label>
        {error && <p className="estado error">{error}</p>}
        <button type="submit" disabled={enCurso}>
          {enCurso ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      <button type="button" className="sec" onClick={() => setModo(modo === 'entrar' ? 'registrar' : 'entrar')}>
        {modo === 'entrar' ? 'No tengo cuenta: crear una' : 'Ya tengo cuenta: entrar'}
      </button>
      <p className="ayuda">Tus planes se guardan en la nube y solo los ves tú.</p>
    </section>
  );
}

function mensajeAmigable(e: unknown): string {
  const t = (e as { message?: string })?.message ?? '';
  if (/invalid login/i.test(t)) return 'Correo o contraseña incorrectos.';
  if (/already registered|already exists/i.test(t)) return 'Ya existe una cuenta con ese correo. Entra en lugar de registrarte.';
  if (/password/i.test(t)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/fetch|network|failed/i.test(t)) return 'Sin conexión. Inténtalo cuando tengas cobertura.';
  return t || 'No se pudo completar la acción.';
}

export function VersionesNube({ cuadrillaId, refresco }: { cuadrillaId: string; refresco: number }) {
  const [versiones, setVersiones] = useState<nube.VersionResumen[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    nube.listarVersiones(cuadrillaId)
      .then((v) => { if (vivo) { setVersiones(v); setError(''); } })
      .catch((e) => { if (vivo) setError(mensajeAmigable(e)); });
    return () => { vivo = false; };
  }, [cuadrillaId, refresco]);

  return (
    <section className="card">
      <h2>Versiones publicadas</h2>
      {error && <p className="estado error">{error}</p>}
      {versiones === null && !error && <p className="ayuda">Cargando…</p>}
      {versiones?.length === 0 && <p className="ayuda">Todavía no has publicado ninguna versión.</p>}
      <div className="lista">
        {versiones?.map((v) => (
          <div className="fila fila-plan" key={v.numero}>
            <span>Versión {v.numero}</span>
            <span className="ayuda">{new Date(v.publicada_en).toLocaleString('es-ES')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
