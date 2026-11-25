import { create } from 'zustand';
import { Telemetry, engine } from '../core/engine';
import { LogEntry } from '../core/log';
import { DEFAULT_SETTINGS, Settings } from '../core/settings';
import { CameraStatus } from '../vision/camera';
import { TrackerStatus } from '../vision/handTracker';

const SETTINGS_KEY = 'bridge.settings.v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw), rosEnabled: false };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_SETTINGS };
}

/** Mission checklist keyed to log events — mirrors the demonstration scenario. */
export const MISSION = [
  { key: 'hand', label: 'Operator hand detected', events: ['hand_detected'] },
  { key: 'armed', label: 'Robot armed (thumbs-up)', events: ['armed'] },
  { key: 'select', label: 'Object selected', events: ['selected'] },
  { key: 'grasp', label: 'Object grasped (pinch)', events: ['grasped'] },
  { key: 'place', label: 'Placed in a destination zone', events: ['placed_zone'] },
  { key: 'estop', label: 'E-stop during motion', events: ['estop_motion'] },
] as const;

export type SystemTab = 'overview' | 'gestures' | 'log' | 'preferences' | 'integration' | 'help';

interface BridgeState {
  settings: Settings;
  telemetry: Telemetry;
  logs: LogEntry[];
  mission: Record<string, boolean>;
  cameraStatus: CameraStatus;
  cameraError: string;
  trackerStatus: TrackerStatus;
  trackerError: string;
  /** 'landing' = front promotional page; 'workspace' = operating view; 'system' = details & settings page */
  view: 'landing' | 'workspace' | 'system';
  systemTab: SystemTab;
  user: { name: string; email: string } | null;
  hoverObject: string | null;
  setSettings: (s: Partial<Settings>) => void;
  resetSettings: () => void;
  set: (p: Partial<BridgeState>) => void;
  openSystem: (tab?: SystemTab) => void;
  clearLogs: () => void;
}

const initialSettings = loadSettings();
engine.applySettings(initialSettings);

export const useBridge = create<BridgeState>((set, get) => ({
  settings: initialSettings,
  telemetry: engine.telemetry(),
  logs: [...engine.log.entries],
  mission: {},
  cameraStatus: 'idle',
  cameraError: '',
  trackerStatus: 'idle',
  trackerError: '',
  view: 'landing',
  systemTab: 'overview',
  user: null,
  hoverObject: null,
  setSettings: (p) => {
    const s = { ...get().settings, ...p };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
    engine.applySettings(s);
    set({ settings: s });
  },
  resetSettings: () => get().setSettings({ ...DEFAULT_SETTINGS }),
  set: (p) => set(p),
  openSystem: (tab) => set({ view: 'system', systemTab: tab ?? get().systemTab }),
  clearLogs: () => {
    engine.log.clear();
    set({ logs: [] });
  },
}));

/* ---- wire the engine into the store (throttled, outside React) ---- */
engine.onTelemetry((t) => useBridge.setState({ telemetry: t }));

let pendingLogs: LogEntry[] = [];
let flushScheduled = false;
engine.log.subscribe((e) => {
  pendingLogs.push(e);
  if (e.event) {
    const m = MISSION.find((x) => (x.events as readonly string[]).includes(e.event!));
    if (m && !useBridge.getState().mission[m.key]) useBridge.setState((s) => ({ mission: { ...s.mission, [m.key]: true } }));
  }
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      const add = pendingLogs;
      pendingLogs = [];
      useBridge.setState((s) => ({ logs: [...s.logs, ...add].slice(-400) }));
    }, 100);
  }
});

engine.camera.onStatus = (s, err) => useBridge.setState({ cameraStatus: s, cameraError: err });
engine.tracker.onStatus = (s, err) => useBridge.setState({ trackerStatus: s, trackerError: err });
