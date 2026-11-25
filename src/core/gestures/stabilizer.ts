import { GestureScores } from './classifier';
import { GESTURES, GestureName } from './types';

export interface StabilizerParams {
  /** minimum smoothed confidence to accept a gesture (0..1) */
  confidenceThreshold: number;
  /** time a candidate must persist before it becomes the stable gesture (ms) */
  activationDelay: number;
  /** activation delay for the emergency-stop gesture (ms) — deliberately short */
  stopDelay: number;
  /** score smoothing time constant (ms) */
  smoothing: number;
}

export const DEFAULT_STABILIZER: StabilizerParams = {
  confidenceThreshold: 0.6,
  activationDelay: 220,
  stopDelay: 120,
  smoothing: 70,
};

export interface StableGesture {
  gesture: GestureName; // stable (debounced) gesture
  confidence: number; // smoothed confidence of the stable gesture
  candidate: GestureName; // current per-frame winner after smoothing
  candidateConfidence: number;
  /** progress of the candidate toward activation (0..1) */
  progress: number;
  since: number; // ms timestamp when the stable gesture became active
  changed: boolean; // stable gesture changed this update
}

/**
 * Temporal smoothing + hysteresis. Scores are low-pass filtered
 * (time-constant based, frame-rate independent); a new gesture only becomes
 * "stable" after it has been the winner above threshold for activationDelay.
 */
export class GestureStabilizer {
  private smoothed: GestureScores = Object.fromEntries(GESTURES.map((g) => [g, 0])) as GestureScores;
  private lastT: number | null = null;
  private candidate: GestureName = 'NONE';
  private candidateSince = 0;
  state: StableGesture = {
    gesture: 'NONE', confidence: 0, candidate: 'NONE', candidateConfidence: 0, progress: 0, since: 0, changed: false,
  };

  constructor(public params: StabilizerParams = { ...DEFAULT_STABILIZER }) {}

  reset(t = 0) {
    for (const g of GESTURES) this.smoothed[g] = 0;
    this.lastT = null;
    this.candidate = 'NONE';
    this.candidateSince = t;
    const changed = this.state.gesture !== 'NONE';
    this.state = { gesture: 'NONE', confidence: 0, candidate: 'NONE', candidateConfidence: 0, progress: 0, since: t, changed };
  }

  update(scores: GestureScores | null, t: number): StableGesture {
    const dt = this.lastT === null ? 1000 : Math.max(0, t - this.lastT);
    this.lastT = t;
    const a = 1 - Math.exp(-dt / Math.max(1, this.params.smoothing));
    for (const g of GESTURES) {
      const target = scores ? scores[g] : g === 'NONE' ? 1 : 0;
      this.smoothed[g] += (target - this.smoothed[g]) * a;
    }
    let best: GestureName = 'NONE';
    let bestS = -1;
    for (const g of GESTURES) {
      if (g === 'NONE') continue;
      if (this.smoothed[g] > bestS) {
        bestS = this.smoothed[g];
        best = g;
      }
    }
    // hysteresis: the current stable gesture keeps winning ties and gets a small bonus
    const cur = this.state.gesture;
    if (cur !== 'NONE' && best !== cur && this.smoothed[cur] + 0.08 >= bestS) {
      best = cur;
      bestS = this.smoothed[cur];
    }
    const thr = this.params.confidenceThreshold;
    let cand: GestureName = bestS >= thr ? best : 'NONE';
    // keep a stable gesture alive with a lower release threshold (hysteresis)
    if (cand === 'NONE' && cur !== 'NONE' && this.smoothed[cur] >= thr * 0.75) cand = cur;

    if (cand !== this.candidate) {
      this.candidate = cand;
      this.candidateSince = t;
    }
    const delay = cand === 'OPEN_PALM' ? this.params.stopDelay : cand === 'NONE' ? this.params.activationDelay * 0.6 : this.params.activationDelay;
    const held = t - this.candidateSince;
    const progress = cand === cur ? 1 : Math.min(1, held / Math.max(1, delay));
    let changed = false;
    if (cand !== cur && held >= delay) {
      changed = true;
      this.state.gesture = cand;
      this.state.since = t;
    }
    this.state = {
      gesture: this.state.gesture,
      confidence: this.state.gesture === 'NONE' ? 0 : this.smoothed[this.state.gesture],
      candidate: cand,
      candidateConfidence: cand === 'NONE' ? 0 : this.smoothed[cand],
      progress,
      since: this.state.since,
      changed,
    };
    return this.state;
  }
}
