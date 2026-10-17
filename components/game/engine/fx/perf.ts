export class PerfManager {
  private reducedMotion = false;
  private lowEnd = false;
  private frameTimes: number[] = [];
  private readonly maxSamples = 120;
  private mediaQuery: MediaQueryList | null = null;
  private boundQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.initReducedMotion();
  }

  private initReducedMotion(): void {
    if (typeof window === "undefined" || !window.matchMedia) return;

    this.mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.mediaQuery.matches;

    this.boundQueryListener = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
    };

    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener("change", this.boundQueryListener);
    } else {
      // Fallback for older browsers
      this.mediaQuery.addListener(this.boundQueryListener);
    }
  }

  public update(delta: number): void {
    if (delta <= 0) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    // Evaluate average FPS once we have sufficient samples
    if (this.frameTimes.length >= 60) {
      const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
      const avgDelta = sum / this.frameTimes.length;
      const avgFps = 1000 / avgDelta;

      // Below 38 FPS triggers low-end mode; recovers if above 52 FPS
      if (!this.lowEnd && avgFps < 38) {
        this.lowEnd = true;
      } else if (this.lowEnd && avgFps > 52) {
        this.lowEnd = false;
      }
    }
  }

  public get isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  public get isLowEnd(): boolean {
    return this.lowEnd;
  }

  public destroy(): void {
    if (this.mediaQuery && this.boundQueryListener) {
      if (this.mediaQuery.removeEventListener) {
        this.mediaQuery.removeEventListener("change", this.boundQueryListener);
      } else {
        this.mediaQuery.removeListener(this.boundQueryListener);
      }
    }
    this.boundQueryListener = null;
    this.mediaQuery = null;
    this.frameTimes = [];
  }
}
