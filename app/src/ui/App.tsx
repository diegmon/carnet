import { useState } from 'preact/hooks';
import { MotorCtx, NavCtx, Nav, Ruta, useMotor, useNav } from './contexto';
import { Aviso, Campo } from './comunes';
import type { Motor } from '../estado/motor';
import { Seguimiento } from './Seguimiento';
import { Carnets, Carnet } from './Carnets';
import { Reunion } from './Reunion';
import { NuevoAcuerdo, DetalleAcuerdo } from './Acuerdo';
import { Documentos } from './Documentos';
import { Anulaciones } from './Anulaciones';
import { PERFIL } from '../../../src/dominio/perfil';

export function App({ motor, inicio }: { motor: Motor; inicio?: Ruta }) {
  return <MotorCtx.Provider value={motor}><Raiz inicio={inicio} /></MotorCtx.Provider>;
}

function Raiz({ inicio }: { inicio?: Ruta }) {
  const m = useMotor();
  const [pila, setPila] = useState<Ruta[]>([inicio ?? { p: 'seguimiento' }]);
  if (!m.sesion && m.soloLectura) {
    return <div class="bienvenida"><h1>Carnet de Atención</h1><p class="aviso">Carnet de Atención ya está abierto en otra pestaña o ventana de este teléfono. Ciérrala y vuelve a abrir esta.</p></div>;
  }
  if (!m.sesion) return <Bienvenida />;
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
        <BarraEstado />
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
  }
}

function BarraEstado() {
  const m = useMotor();
  const n = m.cola.length;
  if (m.soloLectura) return <div class="barra-estado alerta" role="status">Carnet de Atención está abierto en otra pestaña o ventana. Aquí solo puedes consultar.</div>;
  if (m.errorGuardado) return <div class="barra-estado alerta" role="status">{m.errorGuardado}</div>;
  const texto = n === 0 ? 'Todo guardado en este teléfono'
    : `Guardado en este teléfono · ${n} ${n === 1 ? 'cambio' : 'cambios'} por enviar`;
  return <div class="barra-estado" role="status">{texto}</div>;
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

function Bienvenida() {
  const m = useMotor();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [cargo, setCargo] = useState('');
  const [error, setError] = useState('');
  const empezar = async () => {
    if (!nombre.trim() || !/^\S+@\S+\.\S+$/.test(correo.trim())) {
      setError('Escribe tu nombre y tu correo de Google');
      return;
    }
    await m.configurarSesion({ nombre: nombre.trim(), correo, cargo: cargo.trim() });
  };
  return (
    <div class="bienvenida">
      <p class="marca">{PERFIL.institucion}</p>
      <h1>Carnet de Atención</h1>
      <p>Antes de empezar, dinos quién eres. Esto se guarda solo en este teléfono.</p>
      <Campo etiqueta="Tu nombre" valor={nombre} alCambiar={setNombre} />
      <Campo etiqueta="Tu correo de Google" valor={correo} alCambiar={setCorreo} tipo="email" />
      <Campo etiqueta="Tu cargo (opcional)" valor={cargo} alCambiar={setCargo} />
      <Aviso mensaje={error} />
      <button class="primario grande" onClick={empezar}>Empezar</button>
    </div>
  );
}
