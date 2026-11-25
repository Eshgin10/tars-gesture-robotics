export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error';

/** Webcam lifecycle management (getUserMedia). */
export class CameraManager {
  readonly video: HTMLVideoElement;
  stream: MediaStream | null = null;
  status: CameraStatus = 'idle';
  error = '';
  deviceId: string | null = null;
  onStatus?: (s: CameraStatus, error: string) => void;

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.className = 'bridge-video';
  }

  private set(s: CameraStatus, error = '') {
    this.status = s;
    this.error = error;
    this.onStatus?.(s, error);
  }

  static supported() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async listDevices(): Promise<MediaDeviceInfo[]> {
    if (!CameraManager.supported()) return [];
    try {
      return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  async start(deviceId?: string | null): Promise<boolean> {
    if (!CameraManager.supported()) {
      this.set('unavailable', 'This browser does not expose a camera API (requires HTTPS or localhost).');
      return false;
    }
    this.stop();
    this.set('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: deviceId ? undefined : 'user',
        },
        audio: false,
      });
      this.stream = stream;
      this.deviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? null;
      this.video.srcObject = stream;
      await this.video.play().catch(() => undefined);
      await new Promise<void>((res) => {
        if (this.video.readyState >= 2) res();
        else this.video.onloadeddata = () => res();
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => this.set('error', 'Camera disconnected'));
      this.set('active');
      return true;
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') this.set('denied', 'Camera permission was denied.');
      else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') this.set('unavailable', 'No camera found.');
      else this.set('error', e.message || String(err));
      return false;
    }
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    if (this.status === 'active' || this.status === 'requesting') this.set('idle');
  }

  get aspect() {
    return this.video.videoWidth && this.video.videoHeight ? this.video.videoWidth / this.video.videoHeight : 4 / 3;
  }
}
