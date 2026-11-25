/** A single hand landmark. Image landmarks are normalised [0,1] in display space; world landmarks are metres. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

/** One detected hand, already converted to display (mirrored) space. */
export interface HandObservation {
  image: Landmark[]; // 21 points
  world: Landmark[]; // 21 points
  handedness: Handedness;
  score: number;
}

export interface HandFrame {
  t: number; // ms
  hands: HandObservation[];
  source: 'camera' | 'simulated';
  /** width / height of the source image (for isotropic 2-D measurements) */
  aspect: number;
}

export const GESTURES = ['NONE', 'OPEN_PALM', 'POINT', 'PINCH', 'FIST', 'VICTORY', 'THUMBS_UP'] as const;
export type GestureName = (typeof GESTURES)[number];

export const GESTURE_INFO: Record<GestureName, { label: string; action: string; short: string }> = {
  NONE: { label: 'No gesture', action: '—', short: '—' },
  OPEN_PALM: { label: 'Open palm', action: 'Emergency stop', short: 'STOP' },
  POINT: { label: 'Point', action: 'Aim · dwell to select / set target', short: 'SELECT' },
  PINCH: { label: 'Pinch', action: 'Grab · hold & move to transport', short: 'GRAB' },
  FIST: { label: 'Fist', action: 'Neutral / hold position', short: 'HOLD' },
  VICTORY: { label: 'Two fingers (V)', action: 'Release object', short: 'RELEASE' },
  THUMBS_UP: { label: 'Thumbs up', action: 'Confirm / arm / resume', short: 'CONFIRM' },
};

/** MediaPipe hand landmark indices */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
