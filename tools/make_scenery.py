"""Turns the Sketchfab abandoned house and BMX bike .glb files into assets/house.json and assets/bike.json.
Run: python3 -I tools/make_scenery.py house.glb bike.glb
Needs numpy and Pillow (and scipy, through make_guns). The source .glb files are not kept in the repo.

Credits (see README): "Abandoned House" by Sengchor (CC BY 4.0), "BMX Bike" by Erdem Dağdelen (CC BY 4.0).
"""
import json, struct, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np
from PIL import Image
from make_guns import load, mesh, url

ASSETS = HERE.parent / 'assets'


def names_of(path):
    """the node name each mesh part came from, in the order load() returns them"""
    b = open(path, 'rb').read()
    g = json.loads(b[20:20 + struct.unpack_from('<I', b, 12)[0]])
    out = []

    def walk(i, above):
        nd = g['nodes'][i]
        name = nd.get('name', str(i))
        if 'mesh' in nd:
            out.extend([above] * len(g['meshes'][nd['mesh']]['primitives']))
        for c in nd.get('children', []):
            walk(c, name)

    for r in g['scenes'][g.get('scene', 0)]['nodes']:
        walk(r, '')
    return out


def save(name, data):
    dest = ASSETS / name
    dest.write_text(json.dumps(data, separators=(',', ':')))
    print('wrote', dest, dest.stat().st_size // 1024, 'KB')


# ---------------------------------------------------------------- the house
# model metres, then a little bigger so a chunky caveman fits through the door. origin: middle of the walls, on the floor
HOUSE_SCALE = 1.25
HOUSE_MID = np.array([-0.25, 0.0, 0.85])


def house(path):
    parts, mats, image = load(path)
    chunks, dropped = [], 0
    for p in parts:
        c = (p['P'].min(0) + p['P'].max(0)) / 2
        # planks scattered far from the walls would float or sink on sloping ground: leave them out
        if not (-5.2 < c[0] < 5.4 and -3.5 < c[2] < 5.2):
            dropped += 1
            continue
        P = (p['P'] - HOUSE_MID) * HOUSE_SCALE
        chunks.append((P, p['N'], np.clip(p['UV'], 0.001, 0.999), p['F']))
    m = mats[0]
    base = np.asarray(image(m['base']).convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(float)
    if m['ao'] is not None:                                          # bake the soft shadows into the colour
        ao = np.asarray(image(m['ao']).convert('RGB').resize((1024, 1024), Image.LANCZOS))[:, :, :1].astype(float) / 255
        base *= 0.45 + 0.55 * ao
    out = mesh(chunks)
    out['tex'] = url(Image.fromarray(np.clip(base * 1.08, 0, 255).astype(np.uint8)), q=84)
    A = np.concatenate([P[F].reshape(-1, 3) for P, _, _, F in chunks])
    print('house tris', out['n'] // 3, 'dropped planks', dropped, 'min', A.min(0).round(2), 'max', A.max(0).round(2))
    save('house.json', out)


# ---------------------------------------------------------------- the bike
# bike space: origin on the ground between the wheels, +Z forward, +Y up, +X the rider's left, metres.
# a good bit smaller than a real one, on purpose
K = 0.0026
GROUND, MID = -137.5, 1.5                                           # in model units
CHAINRING = np.array([-33.5, -42.0])


def to_bike(P):
    return np.stack([-P[:, 2] * K, (P[:, 1] - GROUND) * K, (P[:, 0] - MID) * K], axis=1)


def point(x, y, z=0.0):
    return [round(float(v), 4) for v in to_bike(np.array([[x, y, z]], float))[0]]


def bike(path):
    parts, mats, image = load(path)
    names = names_of(path)
    cols, rows, cell = 2, 3, 512
    base = Image.new('RGB', (cols * cell, rows * cell))
    nrm = Image.new('RGB', (cols * cell, rows * cell), (128, 128, 255))
    orm = Image.new('RGB', (cols * cell, rows * cell), (255, 160, 60))
    for k, m in enumerate(mats):
        at = ((k % cols) * cell, (k // cols) * cell)

        def tile(i):
            return image(i).convert('RGB').resize((cell, cell), Image.LANCZOS)
        base.paste(tile(m['base']), at)
        nrm.paste(tile(m['normal']), at)
        orm.paste(tile(m['orm']), at)

    groups = {k: [] for k in ('frame', 'steer', 'fwheel', 'rwheel', 'crank', 'pedal')}
    grips = {}
    for p, name in zip(parts, names):
        P, F = p['P'], p['F']
        middle = (P.min(0) + P.max(0)) / 2
        UV = (np.clip(p['UV'], 0.003, 0.997) + [p['m'] % cols, p['m'] // cols]) / [cols, rows]
        N = np.stack([-p['N'][:, 2], p['N'][:, 1], p['N'][:, 0]], axis=1)
        mat = mats[p['m']]
        if name == 'Cube.007':
            continue                                                 # the other pedal: the game draws one twice
        if name == 'Cube.006':
            groups['pedal'].append(((P - middle)[:, [2, 1, 0]] * [-K, K, K], N, UV, F))
            continue
        if name == 'Cylinder.009':                                   # chainring only: the game makes the crank arms
            near = np.linalg.norm(P[F].mean(1)[:, :2] - CHAINRING, axis=1) < 24
            groups['crank'].append((to_bike(P), N, UV, F[near]))
            continue
        if name == 'Cylinder.011':                                   # handlebar: find where the hands go
            for side, sel in (('L', P[:, 2] < -88), ('R', P[:, 2] > 88)):
                grips[side] = to_bike(P[sel]).mean(0).round(4).tolist()
        if name in ('Cylinder.011', 'Cube.005', 'Cylinder.004'):
            key = 'steer'
        elif name in ('Cylinder.006', 'Cylinder.005', 'Cylinder.010', 'Cube.003', 'Cube.002', 'Cube.001', 'Cube.013'):
            key = 'fwheel' if middle[0] > 0 else 'rwheel'
        else:
            key = 'frame'
        groups[key].append((to_bike(P), N, UV, F))
    out = {k: mesh(v) for k, v in groups.items()}
    out['tex'] = {'base': url(base, q=86), 'normal': url(nrm.resize((cell, rows * cell // 2), Image.LANCZOS), q=86),
                  'orm': url(orm.resize((cell, rows * cell // 2), Image.LANCZOS))}
    axis = np.array(point(99, 75)) - np.array(point(141.4, -55.4))
    out['at'] = {'front': point(141.4, -55.4), 'rear': point(-138.4, -55.4), 'crank': point(*CHAINRING),
                 'steer': point(99, 75), 'steerAxis': (axis / np.linalg.norm(axis)).round(4).tolist(),
                 'gripL': grips['L'], 'gripR': grips['R'], 'seat': point(-66, 52),
                 'wheel': round(82 * K, 4), 'arm': round(38 * K, 4), 'pedalX': round(40 * K, 4)}
    for k in groups:
        print('bike', k, 'tris', out[k]['n'] // 3)
    print(out['at'])
    save('bike.json', out)


if __name__ == '__main__':
    house(sys.argv[1])
    bike(sys.argv[2])
