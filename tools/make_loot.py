"""Turns the Sketchfab fish, meat, ESAPI plate and tactical vest .glb files into assets/loot.json (same format as c4.json / guns.json).
Run: python3 -I tools/make_loot.py fish.glb meat.glb plate.glb vest.glb
Needs numpy and Pillow. The source .glb files are large, so they are not kept in the repo.

Every model comes out lying on the ground the way it rests: y up, its lowest point at y = 0, centred in x and z, in metres.
Credits are in the README.
"""
import base64, io, json, sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_read import load

ASSETS = Path(__file__).resolve().parent.parent / 'assets'


def b64(raw):
    return base64.b64encode(raw).decode()


def mesh(P, N, UV, F):
    V = np.concatenate([P[F], N[F], UV[F]], axis=2).reshape(-1, 8).astype('<f4')
    uniq, inv = np.unique(V.round(5), axis=0, return_inverse=True)
    return {'v': b64(uniq.astype('<f4').tobytes()), 'i': b64(inv.ravel().astype('<u4').tobytes()), 'n': int(inv.size)}


def url(im, px=None, q=88):
    im = im.convert('RGB')
    if px and max(im.size) > px:
        k = px / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    f = io.BytesIO()
    im.save(f, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + b64(f.getvalue())


def flat(rgb):
    return url(Image.new('RGB', (4, 4), rgb), q=95)


# how each model is turned to lie on the ground, and how big it really is (the longest side, in metres)
ROT = {
    'fish': np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0.0]]),        # (y, z, x): head along +z, lying on its side
    'meat': np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0.0]]),
    'plate': np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.0]]),      # its thin side up, the curve bulging up
    'vest': np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0.0]]),       # lying on its back, front up
}
SIZE = {'fish': 0.42, 'meat': 0.27, 'plate': 0.30, 'vest': 0.56}
TEX = {'fish': 1024, 'meat': 256, 'plate': 512, 'vest': 1024}


def convert(name, path):
    parts, mats, image = load(path)
    p = parts[0]
    m = mats[p['m']]
    R = ROT[name]
    P = p['P'] @ R.T
    N = p['N'] @ R.T
    F = p['F']
    if np.linalg.det(R) < 0:
        F = F[:, ::-1]
    k = SIZE[name] / np.ptp(P, axis=0).max()
    P = P * k
    lo, hi = P.min(0), P.max(0)
    P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    size = (hi - lo).tolist()
    rough = float(m['rough']) if m['orm'] is None else 1.0
    metal = float(m['metal']) if m['orm'] is None else 1.0
    tex = {
        'base': url(image(m['base']), TEX[name]),
        'normal': url(image(m['normal']), TEX[name]) if m['normal'] is not None else flat((128, 128, 255)),
        'orm': url(image(m['orm']), TEX[name]) if m['orm'] is not None else flat((255, int(255 * min(1, rough)), int(255 * min(1, metal)))),
    }
    out = {'body': mesh(P, N, p['UV'], F), 'tex': tex, 'size': size}
    if name == 'vest':                                          # upright, front towards +z, centred: the lying model turned back up
        U = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.0]])       # (x, z, -y)
        Pu, Nu = P @ U.T, N @ U.T
        Pu = Pu - (Pu.max(0) + Pu.min(0)) / 2
        out['worn'] = worn_vest(Pu, Nu, p['UV'], F, str(ASSETS / 'caveman.glb'), image(m['base']))
    print(name, 'size', [round(x, 3) for x in size], 'verts', len(P), 'tris', len(F))
    return out


def skinned_mesh(P, N, UV, F, J, W):
    """like mesh(), with the bone numbers and weights of every vertex"""
    V = np.concatenate([P[F], N[F], UV[F]], axis=2).reshape(-1, 8).astype('<f4')
    Jc, Wc = J[F].reshape(-1, 4), W[F].reshape(-1, 4)
    uniq, first, inv = np.unique(V.round(5), axis=0, return_index=True, return_inverse=True)
    return {'v': b64(uniq.astype('<f4').tobytes()), 'j': b64(Jc[first].astype('u1').tobytes()), 'w': b64(Wc[first].astype('<f4').tobytes()),
            'i': b64(inv.ravel().astype('<u4').tobytes()), 'n': int(inv.size)}


def smooth(a, k=3):
    """a moving average that keeps the ends"""
    pad = np.pad(a, k, mode='edge')
    return np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode='valid')


def profile(P, ys, hw_limit):
    """per height: the front and back of the middle of the body, and how wide it is"""
    zf, zb, hw = [], [], []
    for y in ys:
        s = P[np.abs(P[:, 1] - y) < 0.022]
        c = s[np.abs(s[:, 0]) < 0.10]
        zf.append(c[:, 2].max() if len(c) else np.nan)
        zb.append(c[:, 2].min() if len(c) else np.nan)
        m = s[np.abs(s[:, 0]) < hw_limit]
        hw.append(np.percentile(np.abs(m[:, 0]), 98) if len(m) else np.nan)
    out = []
    for a in (zf, zb, hw):
        a = np.array(a, float)
        good = ~np.isnan(a)
        a = np.interp(ys, ys[good], a[good])
        out.append(smooth(a))
    return out


CHEST = np.array([0, 1.03, -0.062])          # where his chest bone sits (Rig.rest); the worn vest is built around it


def worn_vest(vest_P, vest_N, vest_UV, vest_F, caveman_path, vest_tex):
    """The vest reshaped to hug the caveman's torso, slice by slice, in the space of his chest bone.
    vest_P is upright (front towards +z), y up, centred."""
    parts, _, _ = load(caveman_path)
    B = parts[0]['P']                                              # his bare skin only: not the loincloth skirt, hair or beard
    ys_b = np.arange(0.66, 1.38, 0.01)
    zf_b, zb_b, hw_b = profile(B, ys_b, 0.34)
    # the model is a plate carrier seen from the front: its back is only straps. Copy the front plate onto the back so it is covered all round.
    zc0 = (vest_P[:, 2].max() + vest_P[:, 2].min()) / 2
    cz = vest_P[vest_F][:, :, 2].mean(1)
    front = vest_F[cz > zc0 + 0.03]
    nv = len(vest_P)
    mir = vest_P.copy(); mir[:, 2] = 2 * zc0 - mir[:, 2]
    mirN = vest_N.copy(); mirN[:, 2] = -mirN[:, 2]
    vest_P = np.concatenate([vest_P, mir]); vest_N = np.concatenate([vest_N, mirN]); vest_UV = np.concatenate([vest_UV, vest_UV])
    vest_F = np.concatenate([vest_F, front[:, ::-1] + nv])
    ylo, yhi = vest_P[:, 1].min(), vest_P[:, 1].max()
    BODY_LO, BODY_HI = 0.76, 1.36                                  # down over his belly, and ending above the loincloth
    t = (vest_P[:, 1] - ylo) / (yhi - ylo)
    yb = BODY_LO + t * (BODY_HI - BODY_LO)
    fb = lambda a: np.interp(yb, ys_b, a)
    # the vest is roughly a box; the body is wider and deeper in some places than others, so each slice is stretched to the body there
    hw_v = np.abs(vest_P[:, 0]).max()
    zc_v, hd_v = (vest_P[:, 2].max() + vest_P[:, 2].min()) / 2, (vest_P[:, 2].max() - vest_P[:, 2].min()) / 2
    zc_b = fb((zf_b + zb_b) / 2)
    hd_b = np.clip(fb((zf_b - zb_b) / 2), 0.12, 0.30)
    sx = np.clip((fb(hw_b) + 0.03) / hw_v, 0.95, 1.5)
    back = vest_P[:, 2] < zc_v
    sz = np.clip((hd_b + np.where(back, 0.07, 0.03)) / hd_v, 0.75, 1.7)     # his back sticks out further than the profile says
    sy = (BODY_HI - BODY_LO) / (yhi - ylo)
    P = np.stack([vest_P[:, 0] * sx, yb, zc_b + (vest_P[:, 2] - zc_v) * sz], axis=1)
    N = vest_N / np.stack([sx, np.full_like(sx, sy), sz], axis=1)
    N /= np.linalg.norm(N, axis=1)[:, None] + 1e-12
    print('worn vest: vest half width %.2f half depth %.2f; scales x %.2f-%.2f z %.2f-%.2f y %.2f' % (hw_v, hd_v, sx.min(), sx.max(), sz.min(), sz.max(), sy))
    # nothing of the vest may sit inside his body. Measure his outline at every height and angle (how far out his skin reaches
    # from the middle of his torso), and push every vest vertex that is inside it out to just above it.
    NB = 72
    Bp0 = parts[0]['P']
    ysT = np.arange(0.58, 1.42, 0.01)
    hull = np.zeros((len(ysT), NB))
    for yi, y in enumerate(ysT):
        sl = Bp0[np.abs(Bp0[:, 1] - y) < 0.02]
        sl = sl[np.abs(sl[:, 0]) < (0.29 if y > 1.15 else 0.40)]
        czy = float(np.interp(y, ys_b, (zf_b + zb_b) / 2))
        ang = np.arctan2(sl[:, 2] - czy, sl[:, 0]); rad = np.hypot(sl[:, 0], sl[:, 2] - czy)
        bins = ((ang + np.pi) / (2 * np.pi) * NB).astype(int) % NB
        for b_ in range(NB):
            m = bins == b_
            if m.any():
                hull[yi, b_] = rad[m].max()
        for _ in range(2):                                                   # fill empty bins, then widen a little so thin gaps are covered
            z0 = hull[yi] == 0
            if z0.any() and (~z0).any():
                hull[yi][z0] = np.interp(np.flatnonzero(z0), np.flatnonzero(~z0), hull[yi][~z0], period=NB)
        hull[yi] = np.maximum.reduce([np.roll(hull[yi], k) for k in (-2, -1, 0, 1, 2)])
    hull = np.array([smooth(h_, 1) for h_ in hull]) if False else hull
    hull = (hull + np.roll(hull, 1, axis=0) + np.roll(hull, -1, axis=0)) / 3     # a little smoothing between heights
    CL = 0.022
    czv = np.interp(P[:, 1], ys_b, (zf_b + zb_b) / 2)
    ang = np.arctan2(P[:, 2] - czv, P[:, 0]); rad = np.hypot(P[:, 0], P[:, 2] - czv)
    yi = np.clip(np.round((P[:, 1] - ysT[0]) / 0.01).astype(int), 0, len(ysT) - 1)
    bi = ((ang + np.pi) / (2 * np.pi) * NB).astype(int) % NB
    need = hull[yi, bi] + CL
    moved = rad < need
    rad2 = np.where(moved, need, rad)
    P = np.stack([rad2 * np.cos(ang), P[:, 1], czv + rad2 * np.sin(ang)], axis=1)
    print('pushed out of his body: %d%% of the vest vertices (largest push %.3f)' % (100 * moved.mean(), (rad2 - rad).max()))
    # the shape has changed, so work the surface directions out again from it, smoothed across shared corners and pointing away from his body
    key = np.round(P, 4)
    _, uid = np.unique(key, axis=0, return_inverse=True)
    uid = uid.ravel()
    fn = np.cross(P[vest_F[:, 1]] - P[vest_F[:, 0]], P[vest_F[:, 2]] - P[vest_F[:, 0]])
    acc = np.zeros((uid.max() + 1, 3))
    for c in range(3):
        np.add.at(acc, uid[vest_F[:, c]], fn)
    N = acc[uid]
    N /= np.linalg.norm(N, axis=1)[:, None] + 1e-12
    out_dir = np.stack([P[:, 0], np.zeros(len(P)), P[:, 2] - czv], axis=1)
    N = N * np.where((N * out_dir).sum(1) < 0, -1.0, 1.0)[:, None]
    allP, allN, allUV, allF = P, N, vest_UV, vest_F
    # skin it to his bones: every vest vertex takes the bone numbers and weights of the nearest bit of his skin, so it moves with his belly, back and chest
    skin = parts[0]
    keep = (np.abs(skin['P'][:, 0]) < 0.45) & (skin['P'][:, 1] > 0.6) & (skin['P'][:, 1] < 1.4)
    Sp, Sj, Sw = skin['P'][keep], skin['J'][keep], skin['W'][keep]
    J = np.zeros((len(allP), 4), np.uint8)
    W = np.zeros((len(allP), 4), np.float32)
    for k in range(0, len(allP), 3000):
        q = allP[k:k + 3000]
        j = ((q[:, None, :] - Sp[None, :, :]) ** 2).sum(-1).argmin(1)
        J[k:k + 3000], W[k:k + 3000] = Sj[j], Sw[j]
    W /= W.sum(1)[:, None] + 1e-9
    return skinned_mesh(allP, allN, allUV, allF, J, W)



if __name__ == '__main__':
    names = ['fish', 'meat', 'plate', 'vest']
    out = {n: convert(n, a) for n, a in zip(names, sys.argv[1:5])}
    out['vestWorn'] = out['vest'].pop('worn')
    (ASSETS / 'loot.json').write_text(json.dumps(out, separators=(',', ':')))
    print('wrote', ASSETS / 'loot.json', (ASSETS / 'loot.json').stat().st_size // 1024, 'KB')
