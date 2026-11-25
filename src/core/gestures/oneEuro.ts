/** One-Euro filter (Casiez et al. 2012): low jitter at rest, low lag when moving. */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t: number | null = null;
  constructor(public minCutoff = 1.2, public beta = 0.02, public dCutoff = 1.0) {}

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset() {
    this.x = null;
    this.t = null;
    this.dx = 0;
  }

  filter(value: number, tMs: number) {
    if (this.x === null || this.t === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class OneEuro2D {
  fx: OneEuroFilter;
  fy: OneEuroFilter;
  constructor(minCutoff = 1.2, beta = 0.02) {
    this.fx = new OneEuroFilter(minCutoff, beta);
    this.fy = new OneEuroFilter(minCutoff, beta);
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
  filter(p: { x: number; y: number }, t: number) {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) };
  }
  set(minCutoff: number, beta: number) {
    this.fx.minCutoff = this.fy.minCutoff = minCutoff;
    this.fx.beta = this.fy.beta = beta;
  }
}
