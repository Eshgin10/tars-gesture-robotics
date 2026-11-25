import { syntheticHand } from './gestures/syntheticHand';
import { GestureName, HandFrame } from './gestures/types';

/**
 * Virtual operator hand — a functional fallback input when no webcam is
 * available. It emits MediaPipe-shaped landmark frames, so the *entire*
 * recognition pipeline (features → classifier → stabiliser → interpreter)
 * runs exactly as with a real camera.
 */
export class SimulatedHand {
  gesture: GestureName = 'NONE';
  center = { x: 0.5, y: 0.55 };
  visible = true;
  /** apparent size multiplier — >1 means the hand is closer to the camera */
  scale = 1;
  noise = 0.0015;

  frame(t: number): HandFrame {
    return {
      t,
      source: 'simulated',
      aspect: 4 / 3,
      hands: this.visible ? [syntheticHand(this.gesture, { center: this.center, noise: this.noise, scale: 1.9 * this.scale })] : [],
    };
  }

  /** Move so that the palm centre sits at a normalised display position. */
  moveTo(x: number, y: number) {
    this.center = { x: Math.min(1.3, Math.max(-0.3, x)), y: Math.min(1.4, Math.max(-0.3, y)) };
  }
}
