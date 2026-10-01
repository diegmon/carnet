"""Genera los íconos de la PWA con los colores del perfil.

Uso: python3 scripts/iconos.py [ruta/al/perfil.json]
Por omisión usa $PERFIL, o privado/perfil.json si existe, o perfil.ejemplo.json.
Los íconos se generan al compilar (npm run build:app) y no se guardan en git.
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ruta = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PERFIL') or ('privado/perfil.json' if os.path.exists('privado/perfil.json') else 'perfil.ejemplo.json')
colores = json.load(open(ruta, encoding='utf-8'))['colores']


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


FONDO, ACENTO, TEXTO = rgb(colores['primario']), rgb(colores['acento']), (255, 255, 255)


def fuente(tam):
    for r in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']:
        try:
            return ImageFont.truetype(r, tam)
        except OSError:
            pass
    return ImageFont.load_default()


def icono(lado, margen, archivo):
    img = Image.new('RGB', (lado, lado), FONDO)
    d = ImageDraw.Draw(img)
    d.text((lado / 2, lado / 2), 'CA', font=fuente(int((lado - 2 * margen) * 0.42)), fill=TEXTO, anchor='mm')
    d.rectangle([margen, lado - margen - lado * 0.06, lado - margen, lado - margen - lado * 0.04], fill=ACENTO)
    img.save(archivo)


icono(192, 16, 'app/public/icono-192.png')
icono(512, 40, 'app/public/icono-512.png')
icono(512, 100, 'app/public/icono-maskable-512.png')
print('íconos listos con', ruta)
