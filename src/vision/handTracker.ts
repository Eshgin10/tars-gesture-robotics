import type { HandLandmarker as HL } from '@mediapipe/tasks-vision';
import { HandFrame, HandObservation, Handedness } from '../core/gestures/types';

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

const LOCAL_WASM = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const LOCAL_MODEL = `${import.meta.env.BASE_URL}models/hand_landmarker.task`;
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * MediaPipe Hand Landmarker wrapper. Runs entirely in the browser
 * (WASM + WebGL/GPU delegate). Converts results into display (mirrored) space.
 */
export class HandTracker {
  status: TrackerStatus = 'idle';
  error = '';
  delegate: 'GPU' | 'CPU' = 'GPU';
  private landmarker: HL | null = null;
  private lastVideoTime = -1;
  private lastFrame: HandFrame | null = null;
  inferenceMs = 0;
  onStatus?: (s: TrackerStatus, err: string) => void;

  private set(s: TrackerStatus, err = '') {
    this.status = s;
    this.error = err;
    this.onStatus?.(s, err);
  }

  async init() {
    if (this.landmarker || this.status === 'loading') return;
    this.set('loading');
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(
        (await exists(`${LOCAL_WASM}/vision_wasm_internal.wasm`)) ? LOCAL_WASM : CDN_WASM,
      );
      const modelAssetPath = (await exists(LOCAL_MODEL)) ? LOCAL_MODEL : CDN_MODEL;
      const opts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
      try {
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU'));
        this.delegate = 'GPU';
      } catch {
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU'));
        this.delegate = 'CPU';
      }
      this.set('ready');
    } catch (err) {
      this.set('error', (err as Error).message || 'Failed to load the hand-tracking model');
    }
  }

  /** Detect on the latest video frame; returns the cached frame if the video has not advanced. */
  detect(video: HTMLVideoElement, mirror: boolean, now: number): HandFrame | null {
    if (!this.landmarker || video.readyState < 2 || !video.videoWidth) return null;
    // a paused / stalled stream must never look like a still-present hand
    if (video.paused || video.ended) {
      void video.play().catch(() => undefined);
      return null;
    }
    if (video.currentTime === this.lastVideoTime) return this.lastFrame;
    this.lastVideoTime = video.currentTime;
    const t0 = performance.now();
    let res;
    try {
      res = this.landmarker.detectForVideo(video, now);
    } catch {
      return this.lastFrame;
    }
    this.inferenceMs = performance.now() - t0;
    const hands: HandObservation[] = [];
    for (let i = 0; i < res.landmarks.length; i++) {
      const cat = res.handedness[i]?.[0];
      // MediaPipe labels handedness assuming a mirrored (selfie) image. We feed the
      // raw camera image, so the operator's actual hand is the opposite label.
      const label = (cat?.categoryName ?? 'Left') as Handedness;
      const actual: Handedness = label === 'Left' ? 'Right' : 'Left';
      const flip = (x: number) => (mirror ? 1 - x : x);
      hands.push({
        image: res.landmarks[i].map((p) => ({ x: flip(p.x), y: p.y, z: p.z })),
        world: (res.worldLandmarks[i] ?? res.landmarks[i]).map((p) => ({ x: mirror ? -p.x : p.x, y: p.y, z: p.z })),
        handedness: actual,
        score: cat?.score ?? 0.9,
      });
    }
    this.lastFrame = { t: now, hands, source: 'camera', aspect: video.videoWidth / video.videoHeight };
    return this.lastFrame;
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.set('idle');
  }
}

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}
