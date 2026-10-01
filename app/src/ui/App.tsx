import { useState } from 'preact/hooks';
import { MotorCtx, NavCtx, Nav, Ruta, useMotor, useNav } from './contexto';
import { IniciarSesion, PanelReautenticar, Acceso } from './Sesion';
import { Problemas } from './Problemas';
import type { Motor } from '../estado/motor';
import { Seguimiento } from './Seguimiento';
import { Carnets, Carnet } from './Carnets';
import { Reunion } from './Reunion';
import { NuevoAcuerdo, DetalleAcuerdo } from './Acuerdo';
import { Documentos } from './Documentos';
import { Anulaciones } from './Anulaciones';

export function App({ motor, inicio, acceso }: { motor: Motor; inicio?: Ruta; acceso?: Acceso }) {
  return <MotorCtx.Provider value={motor}><Raiz inicio={inicio} acceso={acceso} /></MotorCtx.Provider>;
}

function Raiz({ inicio, acceso }: { inicio?: Ruta; acceso?: Acceso }) {
  const m = useMotor();
  const [pila, setPila] = useState<Ruta[]>([inicio ?? { p: 'seguimiento' }]);
  if (!m.sesion && m.soloLectura) {
    return <div class="bienvenida"><h1>Carnet de Atención</h1><p class="aviso">Carnet de Atención ya está abierto en otra pestaña o ventana de este teléfono. Ciérrala y vuelve a abrir esta.</p></div>;
  }
  if (!m.sesion) return <IniciarSesion acceso={acceso} />;
  const ruta = pila[pila.length - 1];
  const nav: Nav = {
    ruta,
    ir: r => setPila(p => [...p, r]),
    atras: () => setPila(p => (p.length > 1 ? p.slice(0, -1) : p)),
    pestana: r => setPila([r]),
  };
  return (
    <NavCtx.Provider value={nav}>
      <div class="app">
        <BarraEstado acceso={acceso} />
        <main class="contenido"><Pantalla ruta={ruta} /></main>
        <Pestanas />
      </div>
    </NavCtx.Provider>
  );
}

function Pantalla({ ruta }: { ruta: Ruta }) {
  switch (ruta.p) {
    case 'seguimiento': return <Seguimiento />;
    case 'carnets': return <Carnets />;
    case 'documentos': return <Documentos />;
    case 'anulaciones': return <Anulaciones />;
    case 'carnet': return <Carnet id={ruta.id} />;
    case 'reunion': return <Reunion id={ruta.id} />;
    case 'nuevo-acuerdo': return <NuevoAcuerdo reunionId={ruta.reunionId} sustituyeA={ruta.sustituyeA} />;
    case 'acuerdo': return <DetalleAcuerdo id={ruta.id} />;
    case 'problemas': return <Problemas />;
  }
}

function BarraEstado({ acceso }: { acceso?: Acceso }) {
  const m = useMotor();
  const nav = useNav();
  const [reautenticar, setReautenticar] = useState(false);
  const n = m.cola.length;
  if (m.soloLectura) return <div class="barra-estado alerta" role="status">Carnet de Atención está abierto en otra pestaña o ventana. Aquí solo puedes consultar.</div>;
  if (m.errorGuardado) return <div class="barra-estado alerta" role="status">{m.errorGuardado}</div>;
  const cambios = `${n} ${n === 1 ? 'cambio guardado' : 'cambios guardados'} en este teléfono`;
  const e = m.estadoSync;
  let texto: string;
  let alerta = false;
  switch (e.fase) {
    case 'enviando': texto = 'Enviando…'; break;
    case 'al_dia': texto = n === 0 ? `Todo enviado · ${String(e.ultimaVez ?? '').slice(11, 16)}` : `Guardado en este teléfono · ${n} por enviar`; break;
    case 'sin_red': texto = `Sin señal · ${cambios}`; break;
    case 'requiere_sesion': texto = `Tu sesión venció · ${cambios}`; alerta = true; break;
    case 'no_autorizado': texto = e.mensaje ?? 'Tu cuenta no está autorizada'; alerta = true; break;
    case 'error': texto = 'No se pudo enviar; se reintentará sola'; break;
    default: texto = n === 0 ? 'Todo guardado en este teléfono' : `Guardado en este teléfono · ${n} ${n === 1 ? 'cambio' : 'cambios'} por enviar`;
  }
  return (
    <div class={`barra-estado${alerta ? ' alerta' : ''}`} role="status">
      <span>{texto}</span>
      <span class="acciones-barra">
        {e.fase === 'requiere_sesion' && acceso && !reautenticar && <button onClick={() => setReautenticar(true)}>Iniciar sesión para enviar</button>}
        {n > 0 && e.fase !== 'enviando' && e.fase !== 'requiere_sesion' && m.alPedirSincronizacion && <button onClick={() => m.alPedirSincronizacion?.()}>Enviar ahora</button>}
        {m.problemas.length > 0 && <button onClick={() => nav.ir({ p: 'problemas' })}>{`Problemas de sincronización (${m.problemas.length})`}</button>}
      </span>
      {reautenticar && acceso && <PanelReautenticar acceso={acceso} alCerrar={() => setReautenticar(false)} />}
    </div>
  );
}

function Pestanas() {
  const nav = useNav();
  const pestanas: [Ruta['p'], string][] = [['seguimiento', 'Seguimiento'], ['carnets', 'Carnets'], ['documentos', 'Documentos']];
  return (
    <nav class="pestanas">
      {pestanas.map(([p, texto]) => (
        <button key={p} aria-current={nav.ruta.p === p ? 'page' : undefined}
          onClick={() => nav.pestana({ p } as Ruta)}>{texto}</button>
      ))}
    </nav>
  );
}
