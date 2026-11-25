export interface Settings {
  confidenceThreshold: number;
  pinchThreshold: number;
  activationDelay: number;
  dwellMs: number;
  moveSensitivity: number;
  heightSensitivity: number; // 0 = off
  pointerSmoothing: number; // 0 (raw) … 1 (heavy)
  robotSpeed: number;
  mirror: boolean;
  showLandmarks: boolean;
  preferredHand: 'auto' | 'Left' | 'Right';
  cameraDeviceId: string | null;
  pauseOnTrackingLoss: boolean;
  requirePlaceConfirm: boolean;
  pointerBox: { minX: number; maxX: number; minY: number; maxY: number };
  rosEnabled: boolean;
  rosUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  confidenceThreshold: 0.6,
  pinchThreshold: 0.26,
  activationDelay: 220,
  dwellMs: 750,
  moveSensitivity: 1.3,
  heightSensitivity: 0.9,
  pointerSmoothing: 0.5,
  robotSpeed: 0.8,
  mirror: true,
  showLandmarks: true,
  preferredHand: 'auto',
  cameraDeviceId: null,
  pauseOnTrackingLoss: true,
  requirePlaceConfirm: true,
  pointerBox: { minX: 0.12, maxX: 0.88, minY: 0.12, maxY: 0.88 },
  rosEnabled: false,
  rosUrl: 'ws://localhost:9090',
};
