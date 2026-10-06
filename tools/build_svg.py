#!/usr/bin/env python3
"""Convierte geoBoundaries-MEX-ADM1_simplified.geojson a un SVG retro 2D.

Genera assets/map/mexico.svg con los 32 estados de Mexico como <path>
clickeables, proyectados a pantalla, simplificados y rejillados (pixel-art).
"""
import json
import math
import sys

SRC = "/tmp/mex.geojson"
OUT = "assets/map/mexico.svg"

TARGET_W = 1000
GRID = 4          # tamano de celda para efecto pixel-art
DP_TOL = 2.0      # tolerancia Douglas-Peucker en px

# shapeName (geoBoundaries) -> (nombre a mostrar, slug)
NAMES = {
    "Aguascalientes": ("Aguascalientes", "aguascalientes"),
    "Baja California": ("Baja California", "baja-california"),
    "Baja California Sur": ("Baja California Sur", "baja-california-sur"),
    "Campeche": ("Campeche", "campeche"),
    "Chiapas": ("Chiapas", "chiapas"),
    "Chihuahua": ("Chihuahua", "chihuahua"),
    "Coahuila de Zaragoza": ("Coahuila", "coahuila"),
    "Colima": ("Colima", "colima"),
    "Distrito Federal": ("Ciudad de México", "cdmx"),
    "Durango": ("Durango", "durango"),
    "Guanajuato": ("Guanajuato", "guanajuato"),
    "Guerrero": ("Guerrero", "guerrero"),
    "Hidalgo": ("Hidalgo", "hidalgo"),
    "Jalisco": ("Jalisco", "jalisco"),
    "Mexico": ("Estado de México", "estado-de-mexico"),
    "Michoacan de Ocampo": ("Michoacán", "michoacan"),
    "Morelos": ("Morelos", "morelos"),
    "Nayarit": ("Nayarit", "nayarit"),
    "Nuevo Leon": ("Nuevo León", "nuevo-leon"),
    "Oaxaca": ("Oaxaca", "oaxaca"),
    "Puebla": ("Puebla", "puebla"),
    "Queretaro de Arteaga": ("Querétaro", "queretaro"),
    "Quintana Roo": ("Quintana Roo", "quintana-roo"),
    "San Luis Potosi": ("San Luis Potosí", "san-luis-potosi"),
    "Sinaloa": ("Sinaloa", "sinaloa"),
    "Sonora": ("Sonora", "sonora"),
    "Tabasco": ("Tabasco", "tabasco"),
    "Tamaulipas": ("Tamaulipas", "tamaulipas"),
    "Tlaxcala": ("Tlaxcala", "tlaxcala"),
    "Veracruz de Ignacio de la Llave": ("Veracruz", "veracruz"),
    "Yucatan": ("Yucatán", "yucatan"),
    "Zacatecas": ("Zacatecas", "zacatecas"),
}


def mercator(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def douglas_peucker(points, tol):
    if len(points) < 3:
        return points
    dmax = 0.0
    idx = 0
    end = len(points) - 1
    for i in range(1, end):
        d = _perp_dist(points[i], points[0], points[end])
        if d > dmax:
            dmax = d
            idx = i
    if dmax > tol:
        left = douglas_peucker(points[: idx + 1], tol)
        right = douglas_peucker(points[idx:], tol)
        return left[:-1] + right
    return [points[0], points[end]]


def _perp_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def ring_to_path(ring):
    # ring: list of (x, y) screen coords
    if not ring:
        return ""
    parts = ["M {} {}".format(ring[0][0], ring[0][1])]
    parts += ["L {} {}".format(x, y) for x, y in ring[1:]]
    parts.append("Z")
    return " ".join(parts)


def ring_area(points):
    a = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def ring_centroid(points):
    a = 0.0
    cx = cy = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        f = x1 * y2 - x2 * y1
        a += f
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    a *= 0.5
    if a == 0:
        return points[0]
    return (cx / (6.0 * a), cy / (6.0 * a))


def main():
    data = json.load(open(SRC))
    feats = data["features"]

    # 1) proyectar todo a mercator y calcular bounds
    proj = {}
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for f in feats:
        name = f["properties"]["shapeName"]
        geo = f["geometry"]
        polys = []
        if geo["type"] == "Polygon":
            polys = [geo["coordinates"]]
        else:
            polys = geo["coordinates"]
        proj_polys = []
        for poly in polys:
            proj_rings = []
            for ring in poly:
                pr = [mercator(c[0], c[1]) for c in ring]
                proj_rings.append(pr)
                for x, y in pr:
                    minx = min(minx, x)
                    maxx = max(maxx, x)
                    miny = min(miny, y)
                    maxy = max(maxy, y)
            proj_polys.append(proj_rings)
        proj[name] = proj_polys

    # 2) escala ajustada preservando aspecto
    w_geo = maxx - minx
    h_geo = maxy - miny
    scale = TARGET_W / w_geo
    PAD = 20
    view_h = h_geo * scale + PAD * 2

    def to_screen(x, y):
        sx = (x - minx) * scale + PAD
        sy = (maxy - y) * scale + PAD  # invertir Y (norte arriba)
        return sx, sy

    # 3) construir paths y centroides
    paths = []
    for f in feats:
        name = f["properties"]["shapeName"]
        display, slug = NAMES[name]
        dparts = []
        best_ring = None
        best_area = -1.0
        for poly in proj[name]:
            for ri, ring in enumerate(poly):
                pts = [to_screen(x, y) for x, y in ring]
                pts = douglas_peucker(pts, DP_TOL)
                # rejilla pixel-art
                pts = [(round(x / GRID) * GRID, round(y / GRID) * GRID) for x, y in pts]
                # eliminar puntos consecutivos duplicados
                dedup = []
                for p in pts:
                    if not dedup or dedup[-1] != p:
                        dedup.append(p)
                if len(dedup) > 1 and dedup[0] == dedup[-1]:
                    dedup = dedup[:-1]
                if len(dedup) >= 3:
                    dparts.append(ring_to_path(dedup + [dedup[0]]))
                    if ri == 0:
                        a = ring_area(dedup)
                        if a > best_area:
                            best_area = a
                            best_ring = dedup
        if dparts:
            if best_ring:
                cx, cy = ring_centroid(best_ring)
                cx = int(round(cx / GRID) * GRID)
                cy = int(round(cy / GRID) * GRID)
            else:
                cx = cy = 0
            d = " ".join(dparts)
            paths.append((slug, display, d, cx, cy))

    # 4) escribir SVG
    h = int(round(view_h))
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" '
        'class="mexico-map" aria-label="Mapa de Mexico">'.format(TARGET_W, h)
    )
    for slug, display, d, cx, cy in paths:
        lines.append(
            '<path id="est-{}" class="state" data-slug="{}" data-name="{}" '
            'data-cx="{}" data-cy="{}" d="{}"/>'.format(slug, slug, display, cx, cy, d)
        )
    lines.append("</svg>")

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    size = len("\n".join(lines))
    print("OK -> {}  ({} bytes, viewBox {}x{})".format(OUT, size, TARGET_W, h))


if __name__ == "__main__":
    main()
