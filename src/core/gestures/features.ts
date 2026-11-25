import { HandObservation, LM, Landmark } from './types';

const sub = (a: Landmark, b: Landmark) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: Landmark) => Math.hypot(a.x, a.y, a.z);
const d = (a: Landmark, b: Landmark) => len(sub(a, b));
const angle = (a: Landmark, b: Landmark) => {
  const la = len(a), lb = len(b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, c)));
};

export interface HandFeatures {
  palmSize: number;
  /** 0 = fully curled … 1 = fully extended, per finger [thumb, index, middle, ring, pinky] */
  extension: [number, number, number, number, number];
  /** total bend angle (deg) per finger */
  bend: [number, number, number, number, number];
  pinchDist: number; // thumb tip ↔ index tip, in palm units
  indexTipToWrist: number; // palm units
  thumbUpness: number; // −1 … 1 (1 = thumb points straight up in the image)
  indexMiddleSpread: number; // tip distance index↔middle, palm units
  fingerSpread: number; // angle (deg) between index and pinky directions
  /** pointer: index fingertip in normalised image coords */
  indexTip: { x: number; y: number };
  /** pointing direction in the image plane (unit, y down) */
  pointDir: { x: number; y: number };
  palmCenter: { x: number; y: number };
  /** apparent palm length in the image (aspect-corrected); grows as the hand nears the camera */
  imagePalmSize: number;
}

const FINGERS: [number, number, number, number][] = [
  [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP],
  [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  [LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP],
  [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP],
];

const RAD = 180 / Math.PI;
const ramp = (x: number, lo: number, hi: number) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));

/** Geometric hand features, invariant to hand scale / position / mirroring. */
export function computeFeatures(hand: HandObservation, aspect = 4 / 3): HandFeatures {
  const w = hand.world.length === 21 ? hand.world : hand.image;
  const wrist = w[LM.WRIST];
  const palmSize = Math.max(1e-6, d(wrist, w[LM.MIDDLE_MCP]));

  const ext: number[] = [];
  const bends: number[] = [];
  // thumb: bend at MCP and IP, plus distance of the tip from the index MCP
  {
    const b =
      angle(sub(w[LM.THUMB_MCP], w[LM.THUMB_CMC]), sub(w[LM.THUMB_IP], w[LM.THUMB_MCP])) +
      angle(sub(w[LM.THUMB_IP], w[LM.THUMB_MCP]), sub(w[LM.THUMB_TIP], w[LM.THUMB_IP]));
    const reach = d(w[LM.THUMB_TIP], w[LM.INDEX_MCP]) / palmSize;
    const bendScore = 1 - ramp(b * RAD, 35, 95);
    const reachScore = ramp(reach, 0.5, 0.75);
    bends.push(b * RAD);
    ext.push(Math.min(1, 0.5 * bendScore + 0.5 * reachScore + 0.15 * Math.min(bendScore, reachScore)));
  }
  for (const [mcp, pip, dip, tip] of FINGERS) {
    const b =
      angle(sub(w[mcp], wrist), sub(w[pip], w[mcp])) +
      angle(sub(w[pip], w[mcp]), sub(w[dip], w[pip])) +
      angle(sub(w[dip], w[pip]), sub(w[tip], w[dip]));
    // straight finger: tip far from wrist relative to PIP
    const ratio = d(w[tip], wrist) / Math.max(1e-6, d(w[pip], wrist));
    const bendScore = 1 - ramp(b * RAD, 50, 150);
    const ratioScore = ramp(ratio, 0.95, 1.45);
    bends.push(b * RAD);
    ext.push(0.6 * bendScore + 0.4 * ratioScore);
  }

  const img = hand.image;
  // isotropic 2-D measurements in the image
  const ix = (p: Landmark) => p.x * aspect;
  const thumbVec = { x: ix(img[LM.THUMB_TIP]) - ix(img[LM.THUMB_MCP]), y: img[LM.THUMB_TIP].y - img[LM.THUMB_MCP].y };
  const tl = Math.hypot(thumbVec.x, thumbVec.y) || 1;
  const pd = { x: ix(img[LM.INDEX_TIP]) - ix(img[LM.INDEX_MCP]), y: img[LM.INDEX_TIP].y - img[LM.INDEX_MCP].y };
  const pl = Math.hypot(pd.x, pd.y) || 1;

  const idxDir = sub(w[LM.INDEX_TIP], w[LM.INDEX_MCP]);
  const pkDir = sub(w[LM.PINKY_TIP], w[LM.PINKY_MCP]);

  const palmPts = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  const pc = palmPts.reduce((a, i) => ({ x: a.x + img[i].x / 5, y: a.y + img[i].y / 5 }), { x: 0, y: 0 });

  return {
    palmSize,
    extension: ext as HandFeatures['extension'],
    bend: bends as HandFeatures['bend'],
    pinchDist: d(w[LM.THUMB_TIP], w[LM.INDEX_TIP]) / palmSize,
    indexTipToWrist: d(w[LM.INDEX_TIP], wrist) / palmSize,
    thumbUpness: -thumbVec.y / tl,
    indexMiddleSpread: d(w[LM.INDEX_TIP], w[LM.MIDDLE_TIP]) / palmSize,
    fingerSpread: angle(idxDir, pkDir) * RAD,
    indexTip: { x: img[LM.INDEX_TIP].x, y: img[LM.INDEX_TIP].y },
    pointDir: { x: pd.x / pl, y: pd.y / pl },
    palmCenter: pc,
    imagePalmSize: Math.hypot(ix(img[LM.MIDDLE_MCP]) - ix(img[LM.WRIST]), img[LM.MIDDLE_MCP].y - img[LM.WRIST].y),
  };
}
