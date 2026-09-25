import { describe, expect, it } from 'vitest';
import {
  findLivenessProblems,
  type LivenessReport,
  type ReportError,
  type ReportResult,
  type ReportSpec,
} from '../verify-e2e-liveness';

const ROOT = '/repo/e2e';

const atLine = (line: number, message = 'Error: expect(locator).toBeVisible() failed'): ReportError => ({
  message,
  location: { file: `${ROOT}/health.spec.ts`, line },
});

const failedAt = (line: number): ReportResult => ({ status: 'failed', errors: [atLine(line)] });

const neverLaunched: ReportResult = {
  status: 'failed',
  errors: [{ message: "Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium" }],
};

const spec = (
  title: string,
  line: number,
  status: string,
  ...results: readonly ReportResult[]
): ReportSpec => ({
  title,
  file: 'health.spec.ts',
  line,
  tests: [{ status, results }],
});

const report = (
  specs: readonly ReportSpec[],
  extra: Partial<LivenessReport> = {},
): LivenessReport => ({
  config: { rootDir: ROOT },
  errors: [],
  suites: [{ specs, suites: [] }],
  ...extra,
});

const alive = report([
  spec('renders pipeline health', 17, 'unexpected', failedAt(21)),
  spec('re-checks health', 37, 'unexpected', {
    status: 'timedOut',
    errors: [{ message: 'Test timeout of 30000ms exceeded.' }, atLine(41)],
  }),
  spec('serves the health procedure', 48, 'unexpected', failedAt(51)),
]);

describe('the E2E liveness rule', () => {
  it('passes a suite in which every spec failed on a line of its own', () => {
    expect(findLivenessProblems(alive, 3)).toEqual([]);
  });

  it('fails a spec that passed against an empty page, naming it', () => {
    const problems = findLivenessProblems(
      report([
        spec('renders pipeline health', 17, 'unexpected', failedAt(21)),
        spec('opens the home page', 30, 'expected', { status: 'passed', errors: [] }),
      ]),
      2,
    );
    expect(problems).toEqual([
      'passed against an empty page, so it asserts nothing the app provides: health.spec.ts:30 opens the home page',
    ]);
  });

  it('fails a skipped spec, which asserts nothing while it stays skipped', () => {
    expect(
      findLivenessProblems(report([spec('re-checks health', 37, 'skipped')]), 1),
    ).toEqual(['was skipped, so it asserts nothing: health.spec.ts:37 re-checks health']);
  });

  it('fails a spec that only passed on a retry', () => {
    expect(
      findLivenessProblems(
        report([spec('re-checks health', 37, 'flaky', failedAt(41), { status: 'passed', errors: [] })]),
        1,
      ),
    ).toEqual([
      'passed against an empty page, so it asserts nothing the app provides: health.spec.ts:37 re-checks health',
    ]);
  });

  it('fails specs that failed before reaching a line of the spec', () => {
    const problems = findLivenessProblems(
      report([
        spec('renders pipeline health', 17, 'unexpected', neverLaunched),
        spec('serves the health procedure', 48, 'unexpected', failedAt(51)),
      ]),
      1,
    );
    expect(problems).toEqual([
      'failed outside the spec, so its own assertions never ran: health.spec.ts:17 renders pipeline health',
      "  Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium",
    ]);
  });

  it('counts an error in a helper under the spec directory as the spec failing', () => {
    const helper: ReportResult = {
      status: 'failed',
      errors: [{ message: 'Error: timed out', location: { file: `${ROOT}/support/login.ts`, line: 4 } }],
    };
    expect(findLivenessProblems(report([spec('signs in', 9, 'unexpected', helper)]), 1)).toEqual([]);
  });

  it('does not mistake a sibling directory with the same prefix for the spec directory', () => {
    const sibling: ReportResult = {
      status: 'failed',
      errors: [{ message: 'Error: boom', location: { file: '/repo/e2e-support/login.ts', line: 4 } }],
    };
    expect(findLivenessProblems(report([spec('signs in', 9, 'unexpected', sibling)]), 1)).toEqual([
      'failed outside the spec, so its own assertions never ran: health.spec.ts:9 signs in',
      '  Error: boom',
    ]);
  });

  it('judges every attempt, not only the first', () => {
    expect(
      findLivenessProblems(
        report([spec('re-checks health', 37, 'unexpected', failedAt(41), neverLaunched)]),
        1,
      ),
    ).not.toEqual([]);
  });

  it('strips terminal colours from the message it quotes', () => {
    const coloured: ReportResult = {
      status: 'failed',
      errors: [{ message: '\u001b[31mTest timeout of 30000ms exceeded.\u001b[39m\nmore detail' }],
    };
    expect(findLivenessProblems(report([spec('re-checks health', 37, 'unexpected', coloured)]), 1)).toEqual([
      'failed outside the spec, so its own assertions never ran: health.spec.ts:37 re-checks health',
      '  Test timeout of 30000ms exceeded.',
    ]);
  });

  it('finds specs inside describe blocks', () => {
    const nested: LivenessReport = {
      ...alive,
      suites: [
        {
          specs: [],
          suites: [
            {
              specs: [spec('opens the home page', 30, 'expected', { status: 'passed', errors: [] })],
            },
          ],
        },
      ],
    };
    expect(findLivenessProblems(nested, 1)).toEqual([
      'passed against an empty page, so it asserts nothing the app provides: health.spec.ts:30 opens the home page',
    ]);
  });
});

describe('a run that proves nothing', () => {
  it('fails a run with no specs, because nothing was shown to fail', () => {
    expect(findLivenessProblems(report([]), 1)).toEqual([
      'no specs ran, so none was shown to fail. Check testDir in playwright.config.ts.',
    ]);
  });

  it('fails a run that Playwright itself reported errors for, and quotes them', () => {
    expect(
      findLivenessProblems(report([], { errors: [{ message: 'Error: No tests found' }] }), 0),
    ).toEqual([
      'Playwright reported an error outside any spec:',
      '  Error: No tests found',
      'no specs ran, so none was shown to fail. Check testDir in playwright.config.ts.',
      'the empty page was never requested, so the specs did not run against it.',
    ]);
  });

  it('fails a run in which the empty page was never requested', () => {
    expect(findLivenessProblems(alive, 0)).toEqual([
      'the empty page was never requested, so the specs did not run against it.',
    ]);
  });
});
