// ======================================================================= abandoned houses
// the model from tools/make_scenery.py, stood on the sites island.js levelled for it. you can walk in through
// the door on the +x side; the walls stop you, bullets and the camera

// the walls, as lines seen from above in the house's own space: x0, z0, x1, z1
const HOUSE_WALLS = [
  [-3.625, -3.0, 3.625, -3.0], [-3.625, 3.0, 3.625, 3.0], [-3.625, -3.0, -3.625, 3.0],      // back, side, side
  [3.625, -3.0, 3.625, 0.56], [3.625, 1.56, 3.625, 3.0],                                    // the front, either side of the door
  [0.31, -3.0, 0.31, -0.06],                                                                // inside: between the rooms
  [0.31, 0.25, 1.19, 0.25], [2.25, 0.25, 3.625, 0.25],
  [-1.56, -1.75, -0.19, -1.75], [-1.56, -3.0, -1.56, -1.75], [-0.19, -3.0, -0.19, -1.75],   // the fireplace
  [4.56, -1.9, 4.56, 0.05]                                                                  // the porch railing
];
const HOUSE_TALL = 3.2;
function addHouseWalls() {
  for (const q of HOUSES) {
    const y = q.base;
    for (const [x0, z0, x1, z1] of HOUSE_WALLS) {
      const a = houseWorld(q, x0, z0), b = houseWorld(q, x1, z1), dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const nx = -dz / len * 0.09, nz = dx / len * 0.09;
      const hull = outline([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]);
      const A = [a[0], y, a[1]], B = [b[0], y, b[1]], C = [b[0], y + HOUSE_TALL, b[1]], D = [a[0], y + HOUSE_TALL, a[1]];
      solids.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, y, r: len / 2 + 0.2, h: HOUSE_TALL, hull, tris: [[A, B, C], [A, C, D]] });
    }
  }
}
// is the camera on the far side of a wall from your head?
function houseBlocks(p) {
  const head = player.pos, q = houseAt((p[0] + head[0]) / 2, (p[2] + head[2]) / 2, 1.5) || houseAt(head[0], head[2], 0.5);
  if (!q || Math.min(p[1], head[1] + 1.5) > q.base + HOUSE_TALL) return false;
  const [ax, az] = houseLocal(q, head[0], head[2]), [bx, bz] = houseLocal(q, p[0], p[2]);
  const side = (ox, oz, px, pz, x, z) => (px - ox) * (z - oz) - (pz - oz) * (x - ox);
  // the walls are stretched a touch, so the camera does not peek round a door post
  return HOUSE_WALLS.some(([x0, z0, x1, z1]) => {
    const ex = Math.sign(x1 - x0) * 0.12, ez = Math.sign(z1 - z0) * 0.12;
    return side(ax, az, bx, bz, x0 - ex, z0 - ez) * side(ax, az, bx, bz, x1 + ex, z1 + ez) < 0 &&
      side(x0 - ex, z0 - ez, x1 + ex, z1 + ez, ax, az) * side(x0 - ex, z0 - ez, x1 + ex, z1 + ez, bx, bz) < 0;
  });
}

// ---------------------------------------------------------------- drawing
const houseModel = new Float32Array(16);
const houseMatrix = q => m4(M3.ry(q.yaw), [q.x, q.base + 0.03, q.z], houseModel);
function drawHouses(vp, light, eye) {
  globals(signProg, vp, light, eye); gl.uniform1i(signProg.u.uTex, 0);
  gl.uniform3fv(signProg.u.uSky, SKY.island); gl.uniform2fv(signProg.u.uFog, fogRange());
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, HOUSE.tex);
  gl.bindVertexArray(HOUSE.mesh.vao);
  for (const q of HOUSES) {
    // not the ones lost in the haze or behind you
    const w = vp[3] * q.x + vp[7] * (q.base + 3) + vp[11] * q.z + vp[15];
    if (w < -12 || Math.hypot(q.x - eye[0], q.z - eye[2]) > fogRange()[1] + 12) continue;
    gl.uniformMatrix4fv(signProg.u.uModel, false, houseMatrix(q));
    gl.drawElements(gl.TRIANGLES, HOUSE.mesh.count, gl.UNSIGNED_INT, 0);
  }
}
// into whichever shadow map is being drawn (staticDepth is already in use)
function drawHouseShadow(at, reach) {
  gl.bindVertexArray(HOUSE.mesh.vao);
  for (const q of HOUSES) {
    if (Math.hypot(q.x - at[0], q.z - at[2]) > reach) continue;
    gl.uniformMatrix4fv(staticDepth.u.uModel, false, houseMatrix(q));
    gl.drawElements(gl.TRIANGLES, HOUSE.mesh.count, gl.UNSIGNED_INT, 0);
  }
  gl.uniformMatrix4fv(staticDepth.u.uModel, false, m4(M3.id(), [0, 0, 0]));
}
