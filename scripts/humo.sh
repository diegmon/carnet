#!/usr/bin/env bash
# Uso: bash scripts/humo.sh https://script.google.com/macros/s/XXXX/exec
set -euo pipefail
URL="${1:?Falta la URL del receptor}"
echo "1) Salud:"
curl -sL "$URL" | tee /dev/stderr | grep -q '"servicio":"Carnet de Atención · receptor"' && echo "   OK"
echo "2) Sin sesión debe responder sesion_vencida:"
curl -sL -H 'Content-Type: text/plain' -d '{"accion":"sincronizar","cursor":0,"ops":[]}' "$URL" \
  | tee /dev/stderr | grep -q '"error":"sesion_vencida"' && echo "   OK"
echo "3) Token falso debe responder sesion_vencida:"
curl -sL -H 'Content-Type: text/plain' -d '{"accion":"sincronizar","id_token":"falso","cursor":0,"ops":[]}' "$URL" \
  | tee /dev/stderr | grep -q '"error":"sesion_vencida"' && echo "   OK"
echo "Prueba de humo completa."
