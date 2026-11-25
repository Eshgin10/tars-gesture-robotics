export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

export const DEG = Math.PI / 180;
export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Vec3, b: Vec3) => len(sub(a, b));
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Wrap an angle to (-PI, PI]. */
export const wrapAngle = (a: number) => {
  let r = (a + Math.PI) % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r - Math.PI;
};
export const fmt = (n: number, d = 3) => (Object.is(n, -0) ? 0 : n).toFixed(d);
export const copy3 = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });

/* ---- Minimal 4x4 homogeneous transforms (column-major like three.js) ---- */
export type Mat4 = Float64Array;
export const identity = (): Mat4 => {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};
export const mul = (a: Mat4, b: Mat4): Mat4 => {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
};
export const trans = (x: number, y: number, z: number): Mat4 => {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
};
export const rotX = (a: number): Mat4 => {
  const m = identity();
  const c = Math.cos(a), s = Math.sin(a);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
};
export const rotY = (a: number): Mat4 => {
  const m = identity();
  const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
};
export const rotZ = (a: number): Mat4 => {
  const m = identity();
  const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
};
export const position = (m: Mat4): Vec3 => ({ x: m[12], y: m[13], z: m[14] });
export const axisX = (m: Mat4): Vec3 => ({ x: m[0], y: m[1], z: m[2] });
export const axisY = (m: Mat4): Vec3 => ({ x: m[4], y: m[5], z: m[6] });
export const axisZ = (m: Mat4): Vec3 => ({ x: m[8], y: m[9], z: m[10] });
