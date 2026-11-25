import { describe, expect, it } from 'vitest';
import { classify } from '../gestures/classifier';
import { computeFeatures } from '../gestures/features';
import { GestureRecognizer } from '../gestures/recognizer';
import { GestureStabilizer } from '../gestures/stabilizer';
import { syntheticHand } from '../gestures/syntheticHand';
import { GESTURES, GestureName, HandFrame } from '../gestures/types';

const rng = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

describe('gesture classifier', () => {
  const targets = GESTURES.filter((g) => g !== 'NONE');

  it.each(targets)('recognises %s', (g) => {
    const f = computeFeatures(syntheticHand(g, { center: { x: 0.5, y: 0.5 } }));
    const c = classify(f);
    expect(c.gesture).toBe(g);
    expect(c.confidence).toBeGreaterThan(0.8);
  });

  it('is robust to position, scale, mirroring and landmark noise', () => {
    const r = rng(42);
    let correct = 0;
    let total = 0;
    for (const g of targets) {
      for (let i = 0; i < 40; i++) {
        const hand = syntheticHand(g, { center: { x: 0.2 + r() * 0.6, y: 0.25 + r() * 0.5 }, scale: 1.4 + r() * 1.0, noise: 0.004, rng: r });
        if (i % 2) {
          hand.image = hand.image.map((p) => ({ ...p, x: 1 - p.x }));
          hand.world = hand.world.map((p) => ({ ...p, x: -p.x }));
        }
        total++;
        if (classify(computeFeatures(hand)).gesture === g) correct++;
      }
    }
    expect(correct / total).toBeGreaterThan(0.95);
  });

  it('a relaxed hand is not mistaken for a command gesture', () => {
    const c = classify(computeFeatures(syntheticHand('NONE', { center: { x: 0.5, y: 0.5 } })));
    expect(c.confidence < 0.6 || c.gesture === 'NONE').toBe(true);
  });

  it('open palm (stop) and victory (release) are clearly separated', () => {
    const palm = classify(computeFeatures(syntheticHand('OPEN_PALM', { center: { x: 0.5, y: 0.5 } })));
    const v = classify(computeFeatures(syntheticHand('VICTORY', { center: { x: 0.5, y: 0.5 } })));
    expect(palm.scores.VICTORY).toBeLessThan(0.2);
    expect(v.scores.OPEN_PALM).toBeLessThan(0.2);
  });
});

describe('gesture stabilizer', () => {
  const scores = (g: GestureName) => Object.fromEntries(GESTURES.map((k) => [k, k === g ? 0.95 : 0])) as Record<GestureName, number>;

  it('requires the activation delay before accepting a gesture', () => {
    const s = new GestureStabilizer({ confidenceThreshold: 0.6, activationDelay: 200, stopDelay: 100, smoothing: 30 });
    let t = 0;
    for (; t <= 150; t += 33) expect(s.update(scores('PINCH'), t).gesture).toBe('NONE');
    for (; t <= 400; t += 33) s.update(scores('PINCH'), t);
    expect(s.state.gesture).toBe('PINCH');
  });

  it('ignores single-frame flicker', () => {
    const s = new GestureStabilizer({ confidenceThreshold: 0.6, activationDelay: 200, stopDelay: 100, smoothing: 60 });
    let t = 0;
    for (; t < 600; t += 33) s.update(scores('POINT'), t);
    expect(s.state.gesture).toBe('POINT');
    s.update(scores('FIST'), (t += 33));
    s.update(scores('POINT'), (t += 33));
    for (let i = 0; i < 10; i++) expect(s.update(scores('POINT'), (t += 33)).gesture).toBe('POINT');
  });

  it('activates the stop gesture faster than other gestures', () => {
    const s = new GestureStabilizer({ confidenceThreshold: 0.6, activationDelay: 300, stopDelay: 100, smoothing: 30 });
    let t = 0;
    while (s.update(scores('OPEN_PALM'), t).gesture !== 'OPEN_PALM') t += 16;
    expect(t).toBeLessThan(250);
  });
});

describe('gesture recognizer (multi-hand)', () => {
  it('detects the stop gesture on either hand, regardless of the primary hand', () => {
    const rec = new GestureRecognizer({ preferredHand: 'Right' });
    let p;
    for (let t = 0; t < 600; t += 33) {
      const frame: HandFrame = {
        t, source: 'simulated', aspect: 4 / 3,
        hands: [
          syntheticHand('PINCH', { center: { x: 0.3, y: 0.5 }, handedness: 'Right' }),
          syntheticHand('OPEN_PALM', { center: { x: 0.7, y: 0.5 }, handedness: 'Left' }),
        ],
      };
      p = rec.process(frame, t);
    }
    expect(p!.primary!.handedness).toBe('Right');
    expect(p!.primary!.stable.gesture).toBe('PINCH');
    expect(p!.stopGesture).toBe(true);
  });
});
