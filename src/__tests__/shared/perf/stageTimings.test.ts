/**
 * Per-stage timing (T065, SC-009).
 *
 * SC-009 sets no threshold, so there is nothing here about how fast anything
 * is. What is asserted is the property the criterion actually depends on: that
 * a regression is ATTRIBUTABLE. Five stages, each recorded on its own, with
 * reads never folded into extraction.
 */

import {
  SPECKIT_STAGES,
  StageTimings,
  setStageTimingSink,
  hostStageTimings,
  webviewStageTimings,
  type StageSnapshot,
} from '../../../shared/perf/stageTimings';

describe('the five stages SC-009 names', () => {
  it('records exactly tokenize, read, extract, resolve and decorate', () => {
    expect([...SPECKIT_STAGES]).toEqual(['tokenize', 'read', 'extract', 'resolve', 'decorate']);
  });

  it('ships one accumulator per runtime, so host and webview figures never mix', () => {
    expect(hostStageTimings).not.toBe(webviewStageTimings);
  });
});

describe('recording', () => {
  let timings: StageTimings;

  beforeEach(() => {
    timings = new StageTimings();
  });

  it('reports reads separately from extraction, never as one number', () => {
    timings.record('read', 8);
    timings.record('extract', 2);

    const snapshot = timings.snapshot();
    expect(snapshot.read?.totalMs).toBe(8);
    expect(snapshot.extract?.totalMs).toBe(2);
  });

  it('counts calls and keeps the worst one, not just the total', () => {
    timings.record('read', 1);
    timings.record('read', 9);
    timings.record('read', 5);

    expect(timings.snapshot().read).toEqual({ calls: 3, totalMs: 15, maxMs: 9 });
  });

  it('leaves a stage that never ran absent rather than reporting a false zero', () => {
    timings.record('resolve', 1);
    expect(timings.snapshot().decorate).toBeUndefined();
  });

  it('returns the measured value untouched', () => {
    expect(timings.measure('extract', () => ['FR-001'])).toEqual(['FR-001']);
    expect(timings.snapshot().extract?.calls).toBe(1);
  });

  it('records a synchronous stage that threw, so a failure is still attributable', () => {
    expect(() =>
      timings.measure('extract', () => {
        throw new Error('bad artifact');
      })
    ).toThrow('bad artifact');
    expect(timings.snapshot().extract?.calls).toBe(1);
  });

  it('records an asynchronous read, including a rejected one', async () => {
    await expect(
      timings.measureAsync('read', () => Promise.reject(new Error('EACCES')))
    ).rejects.toThrow('EACCES');
    expect(timings.snapshot().read?.calls).toBe(1);
  });

  it('subtracts a nested stage, so decorate and tokenize stay disjoint', () => {
    const end = timings.begin('decorate');
    // Every millisecond of the enclosing span is attributed to the nested
    // stage, so the enclosing stage must record nothing rather than a negative.
    end(Number.MAX_SAFE_INTEGER);
    expect(timings.snapshot().decorate?.totalMs).toBe(0);
  });

  it('forgets everything on reset', () => {
    timings.record('read', 3);
    timings.reset();
    expect(timings.snapshot()).toEqual({});
  });
});

describe('reporting', () => {
  let timings: StageTimings;
  let lines: Array<{ line: string; snapshot: StageSnapshot }>;

  beforeEach(() => {
    timings = new StageTimings();
    lines = [];
    setStageTimingSink((line, snapshot) => lines.push({ line, snapshot }));
  });

  afterEach(() => {
    // Back to the suite-wide silent sink installed in setup-after-env.
    setStageTimingSink(() => {});
  });

  it('says nothing when nothing has been measured', () => {
    expect(timings.report('empty')).toBe(false);
    expect(lines).toHaveLength(0);
  });

  it('names every recorded stage and its cost on one line', () => {
    timings.record('read', 8.5);
    timings.record('extract', 3.5);
    timings.record('resolve', 1);

    expect(timings.report('index build')).toBe(true);
    expect(lines[0].line).toContain('index build');
    expect(lines[0].line).toContain('read=8.50ms/1');
    expect(lines[0].line).toContain('extract=3.50ms/1');
    expect(lines[0].line).toContain('resolve=1.00ms/1');
  });

  it('throttles, so a per-keystroke stage cannot flood the log', () => {
    timings.record('decorate', 1);
    expect(timings.report('pass', 60_000)).toBe(true);
    timings.record('decorate', 1);
    expect(timings.report('pass', 60_000)).toBe(false);
    expect(lines).toHaveLength(1);
  });

  it('carries the structured snapshot alongside the line, not just text', () => {
    timings.record('tokenize', 2);
    timings.report('pass');
    expect(lines[0].snapshot.tokenize).toEqual({ calls: 1, totalMs: 2, maxMs: 2 });
  });
});
