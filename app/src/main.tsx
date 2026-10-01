import { arrancar, tomarEscrituraConCandado } from './arranque';
import { persistenciaIdb } from './estado/persistencia';
import './ui/estilos.css';
import { aplicarColores } from './ui/marca';
import { PERFIL } from '../../src/dominio/perfil';

aplicarColores(PERFIL.colores);

arrancar(document.getElementById('app')!, persistenciaIdb(), tomarEscrituraConCandado);
navigator.storage?.persist?.();
