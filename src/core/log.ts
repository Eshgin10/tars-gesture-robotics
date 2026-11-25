export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'safety';
export type LogCategory = 'vision' | 'gesture' | 'command' | 'robot' | 'safety' | 'system';

export interface LogEntry {
  id: number;
  t: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  /** stable event key for mission tracking */
  event?: string;
}

/** Append-only event log with listener fan-out. */
export class EventLog {
  entries: LogEntry[] = [];
  private seq = 1;
  private listeners = new Set<(e: LogEntry) => void>();
  constructor(private max = 400) {}

  push(level: LogLevel, category: LogCategory, message: string, event?: string) {
    const e: LogEntry = { id: this.seq++, t: Date.now(), level, category, message, event };
    this.entries.push(e);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    this.listeners.forEach((l) => l(e));
    return e;
  }
  subscribe(fn: (e: LogEntry) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  clear() {
    this.entries = [];
  }
}
