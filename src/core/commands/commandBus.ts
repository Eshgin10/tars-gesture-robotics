import { EventLog } from '../log';
import { Command, CommandBody, CommandResult, CommandSource, PRIORITY, STREAMING } from './commands';

export interface CommandExecutor {
  execute(cmd: Command): CommandResult;
}

export interface CommandTransport {
  /** called for every accepted (and rejected) command — e.g. forward to ROS 2 */
  onCommand(cmd: Command, result: CommandResult): void;
}

/**
 * Decouples command producers (gesture interpreter, keyboard, UI, remote)
 * from the executor (the simulated robot). Responsibilities:
 *  - stamping (id, source, time)
 *  - priority ordering within a tick (STOP always first)
 *  - duplicate suppression (accidental repeated commands)
 *  - logging & fan-out to transports
 */
export class CommandBus {
  private seq = 1;
  private queue: Command[] = [];
  private lastByType = new Map<string, { t: number; key: string }>();
  transports = new Set<CommandTransport>();
  history: { cmd: Command; result: CommandResult }[] = [];
  lastCommand: { cmd: Command; result: CommandResult } | null = null;
  dedupeWindowMs = 350;

  constructor(private executor: CommandExecutor, private log: EventLog) {}

  /** Queue a command; STOP is executed synchronously for minimum latency. */
  send(body: CommandBody, source: CommandSource, now = performance.now()): CommandResult | null {
    const cmd = { ...body, id: this.seq++, source, t: now } as Command;
    if (cmd.type === 'STOP') return this.run(cmd);
    this.queue.push(cmd);
    return null;
  }

  /** Execute all queued commands in priority order. */
  flush() {
    if (!this.queue.length) return;
    const q = this.queue.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.id - b.id);
    this.queue = [];
    for (const c of q) this.run(c);
  }

  private run(cmd: Command): CommandResult {
    // duplicate suppression for discrete commands
    if (!STREAMING.has(cmd.type) && cmd.type !== 'STOP') {
      const key = JSON.stringify({ ...cmd, id: 0, t: 0 });
      const last = this.lastByType.get(cmd.type);
      if (last && last.key === key && cmd.t - last.t < this.dedupeWindowMs) {
        return { accepted: false, message: 'duplicate suppressed', silent: true };
      }
      this.lastByType.set(cmd.type, { t: cmd.t, key });
    }
    let result: CommandResult;
    try {
      result = this.executor.execute(cmd);
    } catch (err) {
      result = { accepted: false, message: `executor error: ${(err as Error).message}` };
    }
    if (!STREAMING.has(cmd.type)) {
      this.lastCommand = { cmd, result };
      this.history.push({ cmd, result });
      if (this.history.length > 200) this.history.shift();
      if (!result.silent) {
        const src = cmd.source.toUpperCase();
        if (result.accepted) this.log.push(cmd.type === 'STOP' ? 'safety' : 'info', 'command', `${cmd.type} ← ${src}${result.message ? ' · ' + result.message : ''}`);
        else this.log.push('warn', 'command', `${cmd.type} rejected · ${result.message ?? 'invalid in current state'}`);
      }
    }
    this.transports.forEach((t) => {
      try {
        t.onCommand(cmd, result);
      } catch {
        /* transports must never break the control loop */
      }
    });
    return result;
  }
}
