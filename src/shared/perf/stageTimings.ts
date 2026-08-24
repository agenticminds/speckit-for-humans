/**
 * Per-stage timing for the spec-kit ID link pipeline (SC-009).
 *
 * SC-009 is RECORDED, not gated: no latency threshold is set, because an
 * invented number in an enforced gate is worse than an honest measurement with
 * no gate. What the criterion does demand is that a regression be
 * ATTRIBUTABLE — which means the five stages are reported separately, and in
 * particular that file READS are reported apart from EXTRACTION. The budget
 * analysis says extraction costs 3.5ms for the largest real feature folder
 * while the reads around it cost far more, so a single combined number would
 * hide the half that actually moved.
 *
 * The five stages are DISJOINT by construction. `decorate` excludes the
 * `tokenize` time nested inside it, and `resolve` excludes the reads and
 * extractions that precede it, so the recorded figures add up rather than
 * double-counting.
 *
 * This module is pure and runtime-agnostic: it is used from the extension host
 * and from the webview, and it touches neither the VS Code API nor the DOM.
 */

/**
 * The five stages SC-009 names.
 *
 * - `tokenize` — recognizing identifiers in a run of text (webview).
 * - `read` — pulling an artifact's bytes off disk or out of an open editor
 *   buffer (host). Separate from `extract` so cold I/O on a network drive or a
 *   container mount is visible on its own.
 * - `extract` — finding definition sites in text already read (host).
 * - `resolve` — ordering the definitions into the resolution sequence the
 *   webview consumes (host).
 * - `decorate` — turning recognized tokens into a decoration set (webview),
 *   less the tokenize time nested inside it.
 */
export type SpeckitStage = 'tokenize' | 'read' | 'extract' | 'resolve' | 'decorate';

export const SPECKIT_STAGES: readonly SpeckitStage[] = [
  'tokenize',
  'read',
  'extract',
  'resolve',
  'decorate',
];

/** What was measured for one stage since the last reset. */
export interface StageSample {
  /** How many times the stage ran. A cost per call is useless without it. */
  calls: number;
  /** Total wall time, in milliseconds. */
  totalMs: number;
  /** The single worst call, which is what a user actually feels. */
  maxMs: number;
}

export type StageSnapshot = Partial<Record<SpeckitStage, StageSample>>;

/** Where a report is written. Replaceable so a test run is not flooded with them. */
export type StageTimingSink = (line: string, snapshot: StageSnapshot) => void;

const defaultSink: StageTimingSink = (line, snapshot) => {
  // `debug`, never `warn`: a measurement is not a problem, and a warning would
  // put a routine timing line in the same channel as a real fault. The lint
  // rule allows only `warn` and `error` in shared code, which is the right
  // default and the wrong answer for an instrumentation sink.
  // eslint-disable-next-line no-console
  console.debug(line, snapshot);
};

let sink: StageTimingSink = defaultSink;

/**
 * Redirect every accumulator's reports.
 *
 * Exists for the test setup, which silences them: these stages run on every
 * keystroke, and a decoration test would otherwise print a timing line per
 * assertion. Recording is unaffected — only where the line goes changes.
 */
export function setStageTimingSink(next: StageTimingSink | null): void {
  sink = next ?? defaultSink;
}

/** Monotonic where available, wall clock otherwise. Never throws. */
function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * An accumulator for one runtime's stage costs.
 *
 * Accumulating rather than logging per call is deliberate: `tokenize` and
 * `decorate` run on every keystroke, and a log line per keystroke would itself
 * be the performance problem the measurement exists to detect.
 */
export class StageTimings {
  private readonly samples = new Map<SpeckitStage, StageSample>();
  private lastReportAt = 0;

  /** Add an already-measured duration. */
  record(stage: SpeckitStage, elapsedMs: number): void {
    const existing = this.samples.get(stage);
    if (existing) {
      existing.calls += 1;
      existing.totalMs += elapsedMs;
      existing.maxMs = Math.max(existing.maxMs, elapsedMs);
      return;
    }
    this.samples.set(stage, { calls: 1, totalMs: elapsedMs, maxMs: elapsedMs });
  }

  /** Time a synchronous stage. The value is returned untouched. */
  measure<T>(stage: SpeckitStage, work: () => T): T {
    const started = now();
    try {
      return work();
    } finally {
      this.record(stage, now() - started);
    }
  }

  /** Time an asynchronous stage. Records on rejection too, so a failed read still shows. */
  async measureAsync<T>(stage: SpeckitStage, work: () => Promise<T>): Promise<T> {
    const started = now();
    try {
      return await work();
    } finally {
      this.record(stage, now() - started);
    }
  }

  /**
   * Start a manual span, for a stage whose work cannot be wrapped in a callback
   * — `decorate` subtracting its nested `tokenize` time, for one.
   *
   * @returns a function that records the elapsed time, optionally less an
   *   amount already attributed to a nested stage.
   */
  begin(stage: SpeckitStage): (excludeMs?: number) => void {
    const started = now();
    return (excludeMs = 0) => {
      this.record(stage, Math.max(0, now() - started - excludeMs));
    };
  }

  /** A plain copy of what has been recorded. Safe to hand to a test or a log. */
  snapshot(): StageSnapshot {
    const out: StageSnapshot = {};
    for (const stage of SPECKIT_STAGES) {
      const sample = this.samples.get(stage);
      if (sample) {
        out[stage] = { ...sample };
      }
    }
    return out;
  }

  reset(): void {
    this.samples.clear();
    this.lastReportAt = 0;
  }

  /** One line per report, stages in fixed order, so two runs can be diffed. */
  format(label: string): string {
    const parts: string[] = [];
    for (const stage of SPECKIT_STAGES) {
      const sample = this.samples.get(stage);
      if (!sample) {
        continue;
      }
      parts.push(
        `${stage}=${sample.totalMs.toFixed(2)}ms/${sample.calls} (max ${sample.maxMs.toFixed(2)}ms)`
      );
    }
    return `[Speckit] speckit timings ${label}: ${parts.length > 0 ? parts.join(' ') : 'nothing recorded'}`;
  }

  /**
   * Emit the current figures, at most once per `minIntervalMs`.
   *
   * Throttled because the webview stages run per keystroke, and a log line per
   * keystroke would itself be the latency the measurement exists to catch.
   *
   * @returns whether anything was emitted, so a test can assert the throttle.
   */
  report(label: string, minIntervalMs = 2000): boolean {
    if (this.samples.size === 0) {
      return false;
    }
    const at = now();
    if (this.lastReportAt !== 0 && at - this.lastReportAt < minIntervalMs) {
      return false;
    }
    this.lastReportAt = at;
    sink(this.format(label), this.snapshot());
    return true;
  }
}

/**
 * The extension host's accumulator: `read`, `extract` and `resolve`.
 *
 * Module state rather than an instance field, so the figures survive a store
 * being rebuilt and so a test can read them without reaching into the store.
 */
export const hostStageTimings = new StageTimings();

/** The webview's accumulator: `tokenize` and `decorate`. */
export const webviewStageTimings = new StageTimings();
