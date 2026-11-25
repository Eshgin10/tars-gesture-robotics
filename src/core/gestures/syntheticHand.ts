import { GestureName, HandObservation, Handedness, LM, Landmark } from './types';

/**
 * Procedural hand model producing MediaPipe-compatible landmarks.
 * Used for: the simulated-hand input fallback (no webcam), gesture glyphs in
 * the UI, and automated tests of the full recognition pipeline.
 * Coordinates: x right, y down, z toward the camera is negative (as MediaPipe).
 */
type FingerPose = [number, number, number]; // MCP, PIP, DIP flexion (deg)

interface HandPose {
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose]; // index, middle, ring, pinky
  spread: number; // multiplier on the natural splay
  thumbDir: [number, number, number];
  thumbBend: [number, number]; // MCP, IP flexion (deg)
  roll: number; // in-plane rotation of the whole hand (deg)
  pinch?: boolean; // place the thumb tip on the index tip
}

const STRAIGHT: FingerPose = [4, 4, 2];
const CURLED: FingerPose = [88, 105, 65];
const RELAXED: FingerPose = [28, 42, 22];

export const POSES: Record<GestureName, HandPose> = {
  NONE: { fingers: [RELAXED, RELAXED, RELAXED, RELAXED], spread: 0.7, thumbDir: [-0.8, -0.5, -0.25], thumbBend: [20, 25], roll: 0 },
  OPEN_PALM: { fingers: [STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT], spread: 1.7, thumbDir: [-0.78, -0.62, -0.05], thumbBend: [4, 4], roll: 0 },
  POINT: { fingers: [STRAIGHT, CURLED, CURLED, CURLED], spread: 1, thumbDir: [-0.45, -0.85, -0.3], thumbBend: [40, 55], roll: 0 },
  PINCH: { fingers: [[30, 40, 20], [30, 35, 20], [35, 40, 25], [40, 45, 25]], spread: 1, thumbDir: [-0.7, -0.6, -0.3], thumbBend: [10, 10], roll: 0, pinch: true },
  FIST: { fingers: [CURLED, CURLED, CURLED, CURLED], spread: 0.8, thumbDir: [-0.35, -0.9, -0.35], thumbBend: [55, 60], roll: 0 },
  VICTORY: { fingers: [STRAIGHT, STRAIGHT, CURLED, CURLED], spread: 2.4, thumbDir: [-0.4, -0.85, -0.35], thumbBend: [45, 55], roll: 0 },
  THUMBS_UP: { fingers: [CURLED, CURLED, CURLED, CURLED], spread: 0.8, thumbDir: [-1, -0.12, -0.1], thumbBend: [3, 3], roll: 90 },
};

const MCP_POS: [number, number, number][] = [
  [-0.025, -0.086, 0],
  [-0.004, -0.09, 0],
  [0.016, -0.085, 0],
  [0.033, -0.074, 0],
];
const SPLAY = [-7, 0, 7, 15]; // deg
const BONES = [
  [0.041, 0.025, 0.022],
  [0.045, 0.028, 0.024],
  [0.042, 0.026, 0.022],
  [0.033, 0.02, 0.018],
];
const THUMB_CMC: [number, number, number] = [-0.024, -0.026, -0.008];
const THUMB_BONES = [0.042, 0.032, 0.027];

type V = [number, number, number];
const addv = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulv = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const normv = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dotv = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function chain(origin: V, d0: V, n: V, bones: number[], bends: number[]): V[] {
  const pts: V[] = [];
  let p = origin;
  let theta = 0;
  for (let k = 0; k < bones.length; k++) {
    theta += (bends[k] * Math.PI) / 180;
    const dir = addv(mulv(d0, Math.cos(theta)), mulv(n, Math.sin(theta)));
    p = addv(p, mulv(dir, bones[k]));
    pts.push(p);
  }
  return pts;
}

/** Canonical (wrist-origin, metres) landmarks for a pose. */
export function poseLandmarks(pose: HandPose): V[] {
  const pts: V[] = new Array(21);
  pts[LM.WRIST] = [0, 0, 0];
  const towardCam: V = [0, 0, -1];
  for (let f = 0; f < 4; f++) {
    const a = (SPLAY[f] * pose.spread * Math.PI) / 180;
    const d0: V = [Math.sin(a), -Math.cos(a), 0];
    const mcp = MCP_POS[f];
    const [p1, p2, p3] = chain(mcp, d0, towardCam, BONES[f], pose.fingers[f]);
    const base = 5 + f * 4;
    pts[base] = mcp;
    pts[base + 1] = p1;
    pts[base + 2] = p2;
    pts[base + 3] = p3;
  }
  pts[LM.THUMB_CMC] = THUMB_CMC;
  const t0 = normv(pose.thumbDir);
  if (pose.pinch) {
    const tip = addv(pts[LM.INDEX_TIP], [-0.004, 0.003, -0.002]);
    const toTip = normv(addv(tip, mulv(THUMB_CMC, -1)));
    const mcp = addv(THUMB_CMC, mulv(normv(addv(mulv(toTip, 0.7), mulv(t0, 0.3))), THUMB_BONES[0]));
    const mid = mulv(addv(mcp, tip), 0.5);
    const ip = addv(mid, [-0.008, 0.002, -0.004]);
    pts[LM.THUMB_MCP] = mcp;
    pts[LM.THUMB_IP] = ip;
    pts[LM.THUMB_TIP] = tip;
  } else {
    // thumb flexes toward the palm centre / the camera
    let n: V = normv([1, -0.25, -0.7]);
    n = normv(addv(n, mulv(t0, -dotv(n, t0))));
    const [m, ip, tip] = chain(THUMB_CMC, t0, n, THUMB_BONES, [0, pose.thumbBend[0], pose.thumbBend[1]]);
    pts[LM.THUMB_MCP] = m;
    pts[LM.THUMB_IP] = ip;
    pts[LM.THUMB_TIP] = tip;
  }
  // in-plane roll about the wrist
  const r = (pose.roll * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return pts.map(([x, y, z]) => [x * c - y * s, x * s + y * c, z] as V);
}

export interface SyntheticOptions {
  /** palm centre in normalised display coords */
  center: { x: number; y: number };
  scale?: number; // normalised image width per metre
  aspect?: number;
  handedness?: Handedness;
  noise?: number; // metres of landmark jitter
  rng?: () => number;
}

/** Build a full HandObservation for a gesture at a given screen position. */
export function syntheticHand(gesture: GestureName, opts: SyntheticOptions): HandObservation {
  const pose = POSES[gesture];
  const scale = opts.scale ?? 1.9;
  const aspect = opts.aspect ?? 4 / 3;
  const rng = opts.rng ?? Math.random;
  const noise = opts.noise ?? 0;
  let pts = poseLandmarks(pose);
  if (noise > 0) pts = pts.map(([x, y, z]) => [x + (rng() - 0.5) * noise, y + (rng() - 0.5) * noise, z + (rng() - 0.5) * noise] as V);
  // centre on the palm (mean of wrist + MCPs)
  const palmIdx = [0, 5, 9, 13, 17];
  const pc = palmIdx.reduce<V>((a, i) => addv(a, mulv(pts[i], 1 / 5)), [0, 0, 0]);
  const world: Landmark[] = pts.map(([x, y, z]) => ({ x: x - pc[0], y: y - pc[1], z: z - pc[2] }));
  const image: Landmark[] = world.map((p) => ({
    x: opts.center.x + p.x * scale,
    y: opts.center.y + p.y * scale * aspect,
    z: p.z * scale,
  }));
  return { image, world, handedness: opts.handedness ?? 'Right', score: 0.98 };
}
