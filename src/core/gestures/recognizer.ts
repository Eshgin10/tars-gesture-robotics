import { ClassifierParams, DEFAULT_CLASSIFIER, GestureScores, classify } from './classifier';
import { HandFeatures, computeFeatures } from './features';
import { OneEuro2D, OneEuroFilter } from './oneEuro';
import { DEFAULT_STABILIZER, GestureStabilizer, StabilizerParams, StableGesture } from './stabilizer';
import { GestureName, HandFrame, HandObservation, Handedness } from './types';

export interface HandPerception {
  handedness: Handedness;
  detectionScore: number;
  observation: HandObservation;
  features: HandFeatures;
  raw: { gesture: GestureName; confidence: number; scores: GestureScores };
  stable: StableGesture;
  /** filtered index fingertip (normalised display coords) */
  pointer: { x: number; y: number };
  /** filtered palm centre (normalised display coords) */
  palm: { x: number; y: number };
  /** filtered apparent hand size (depth cue) */
  scale: number;
}

export interface Perception {
  t: number;
  source: HandFrame['source'] | 'none';
  handCount: number;
  primary: HandPerception | null;
  hands: HandPerception[];
  /** stable open palm on ANY hand (E-stop has priority over hand selection) */
  stopGesture: boolean;
  latencyMs: number;
}

export interface RecognizerParams {
  classifier: ClassifierParams;
  stabilizer: StabilizerParams;
  preferredHand: 'auto' | Handedness;
  /** One-Euro filter params for pointer smoothing */
  filterMinCutoff: number;
  filterBeta: number;
}

export const DEFAULT_RECOGNIZER: RecognizerParams = {
  classifier: { ...DEFAULT_CLASSIFIER },
  stabilizer: { ...DEFAULT_STABILIZER },
  preferredHand: 'auto',
  filterMinCutoff: 1.4,
  filterBeta: 0.4,
};

interface Track {
  stabilizer: GestureStabilizer;
  pointer: OneEuro2D;
  palm: OneEuro2D;
  scale: OneEuroFilter;
  lastSeen: number;
}

/**
 * Reusable gesture-recognition engine: features → per-frame classification →
 * temporal stabilisation, tracked per hand (keyed by handedness).
 * Has no knowledge of robots — it only produces Perception.
 */
export class GestureRecognizer {
  params: RecognizerParams;
  private tracks = new Map<Handedness, Track>();
  private primaryKey: Handedness | null = null;

  constructor(params: Partial<RecognizerParams> = {}) {
    this.params = { ...DEFAULT_RECOGNIZER, ...params };
  }

  private track(h: Handedness): Track {
    let tr = this.tracks.get(h);
    if (!tr) {
      tr = {
        stabilizer: new GestureStabilizer(this.params.stabilizer),
        pointer: new OneEuro2D(this.params.filterMinCutoff, this.params.filterBeta),
        palm: new OneEuro2D(this.params.filterMinCutoff, this.params.filterBeta),
        scale: new OneEuroFilter(0.8, 0.5),
        lastSeen: 0,
      };
      this.tracks.set(h, tr);
    }
    tr.stabilizer.params = this.params.stabilizer;
    tr.pointer.set(this.params.filterMinCutoff, this.params.filterBeta);
    tr.palm.set(this.params.filterMinCutoff, this.params.filterBeta);
    return tr;
  }

  reset() {
    this.tracks.clear();
    this.primaryKey = null;
  }

  process(frame: HandFrame | null, t: number): Perception {
    const t0 = performance.now();
    const hands: HandPerception[] = [];
    const seen = new Set<Handedness>();
    if (frame) {
      // de-duplicate handedness (MediaPipe can occasionally label both hands the same)
      const obs = [...frame.hands].sort((a, b) => b.score - a.score);
      for (const o of obs) {
        let key = o.handedness;
        if (seen.has(key)) key = key === 'Left' ? 'Right' : 'Left';
        if (seen.has(key)) continue;
        seen.add(key);
        const tr = this.track(key);
        tr.lastSeen = t;
        const features = computeFeatures(o, frame.aspect);
        const raw = classify(features, this.params.classifier);
        const stable = tr.stabilizer.update(raw.scores, t);
        hands.push({
          handedness: key,
          detectionScore: o.score,
          observation: o,
          features,
          raw,
          stable: { ...stable },
          pointer: tr.pointer.filter(features.indexTip, t),
          palm: tr.palm.filter(features.palmCenter, t),
          scale: tr.scale.filter(features.imagePalmSize, t),
        });
      }
    }
    // tracks unseen for longer than a short grace period are reset
    for (const [k, tr] of this.tracks) {
      if (!seen.has(k) && t - tr.lastSeen > 200) {
        tr.stabilizer.reset(t);
        tr.pointer.reset();
        tr.palm.reset();
        tr.scale.reset();
      }
    }
    // primary hand: preferred handedness, else sticky previous, else most confident
    let primary: HandPerception | null = null;
    const pref = this.params.preferredHand;
    if (pref !== 'auto') primary = hands.find((h) => h.handedness === pref) ?? null;
    if (!primary && this.primaryKey) primary = hands.find((h) => h.handedness === this.primaryKey) ?? null;
    if (!primary && hands.length) primary = hands[0];
    this.primaryKey = primary?.handedness ?? null;

    return {
      t,
      source: frame?.source ?? 'none',
      handCount: hands.length,
      primary,
      hands,
      stopGesture: hands.some((h) => h.stable.gesture === 'OPEN_PALM'),
      latencyMs: performance.now() - t0,
    };
  }
}
