import { arrancar, tomarEscrituraConCandado } from './arranque';
import { persistenciaIdb } from './estado/persistencia';
import { leerConfig } from './config';
import './ui/estilos.css';
import { aplicarColores } from './ui/marca';
import { PERFIL } from '../../src/dominio/perfil';

aplicarColores(PERFIL.colores);
arrancar(document.getElementById('app')!, persistenciaIdb(), tomarEscrituraConCandado, { config: leerConfig(import.meta.env) });
navigator.storage?.persist?.();
