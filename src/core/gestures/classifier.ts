import { HandFeatures } from './features';
import { GESTURES, GestureName } from './types';

export interface ClassifierParams {
  /** thumb–index distance (palm units) below which a pinch is recognised */
  pinchThreshold: number;
}
export const DEFAULT_CLASSIFIER: ClassifierParams = { pinchThreshold: 0.26 };

export type GestureScores = Record<GestureName, number>;

const ramp = (x: number, lo: number, hi: number) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
const extended = (e: number) => ramp(e, 0.45, 0.75);
const curled = (e: number) => 1 - ramp(e, 0.3, 0.55);

/**
 * Rule-based gesture classifier on geometric features. Each gesture gets a
 * fuzzy membership score in [0,1] (min of its conditions). Runs locally in
 * well under a millisecond per frame — no ML model or network call.
 */
export function scoreGestures(f: HandFeatures, p: ClassifierParams = DEFAULT_CLASSIFIER): GestureScores {
  const [t, i, m, r, k] = f.extension;
  const thr = p.pinchThreshold;
  const pinchClose = 1 - ramp(f.pinchDist, thr, thr + 0.12);
  const pinchFar = ramp(f.pinchDist, thr + 0.1, thr + 0.35);
  const fourCurled = Math.min(curled(i), curled(m), curled(r), curled(k));
  const thumbOut = ramp(t, 0.45, 0.7);
  const thumbUp = ramp(f.thumbUpness, 0.55, 0.85);

  const s: GestureScores = {
    NONE: 0,
    OPEN_PALM: Math.min(thumbOut, extended(i), extended(m), extended(r), extended(k), ramp(f.fingerSpread, 6, 18), pinchFar),
    POINT: Math.min(extended(i), curled(m), curled(r), curled(k), pinchFar),
    PINCH: Math.min(pinchClose, ramp(f.indexTipToWrist, 0.95, 1.25), 1 - 0.6 * Math.min(curled(i), thumbUp)),
    VICTORY: Math.min(extended(i), extended(m), curled(r), curled(k), ramp(f.indexMiddleSpread, 0.22, 0.4)),
    THUMBS_UP: Math.min(thumbOut, thumbUp, fourCurled, pinchFar),
    FIST: Math.min(fourCurled, 1 - Math.min(thumbOut, thumbUp), 1 - pinchClose * ramp(f.indexTipToWrist, 0.95, 1.25)),
  };
  const best = Math.max(...GESTURES.filter((g) => g !== 'NONE').map((g) => s[g]));
  s.NONE = Math.max(0, 0.5 - best);
  return s;
}

export function classify(f: HandFeatures, p?: ClassifierParams): { gesture: GestureName; confidence: number; scores: GestureScores } {
  const scores = scoreGestures(f, p);
  let gesture: GestureName = 'NONE';
  let confidence = scores.NONE;
  for (const g of GESTURES) {
    if (scores[g] > confidence) {
      gesture = g;
      confidence = scores[g];
    }
  }
  return { gesture, confidence, scores };
}
