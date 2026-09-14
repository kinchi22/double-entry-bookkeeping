import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

/**
 * Section 9, applied to the E2E suite: a pure function, plus a CLI entry point.
 * ADR-0006.
 *
 * A green suite never proves a spec asserts anything. A spec that opens the
 * home page and checks nothing passes against the app, and passes again against
 * a page with nothing on it. So the specs are run against exactly that page --
 * an empty 200 at `/`, 404 everywhere else -- and every one of them has to fail.
 *
 * Failing is not enough on its own. Measured on Playwright 1.62: with no browser
 * installed, every spec in `e2e/health.spec.ts` failed too, in `browserType.launch`,
 * before a line of any spec ran. What separates the two runs is where the error
 * points. A spec that failed on its own assertion carries an error located in
 * the spec directory; one that failed in the harness carries none.
 *
 * The decision is a function over Playwright's JSON report, because that is the
 * part that can be wrong. The server and the Playwright run are the CLI below.
 */

type ReportError = {
  readonly message: string;
  readonly location?: { readonly file: string; readonly line: number };
};

type ReportResult = { readonly status: string; readonly errors: readonly ReportError[] };

type ReportSpec = {
  readonly title: string;
  /** Relative to `config.rootDir`. */
  readonly file: string;
  readonly line: number;
  readonly tests: readonly { readonly status: string; readonly results: readonly ReportResult[] }[];
};

type ReportSuite = { readonly specs: readonly ReportSpec[]; readonly suites?: readonly ReportSuite[] };

/** The part of Playwright's JSON report this reads. A full report satisfies it. */
export type LivenessReport = {
  readonly config: { readonly rootDir: string };
  readonly errors: readonly { readonly message: string }[];
  readonly suites: readonly ReportSuite[];
};

const firstLine = (message: string): string =>
  stripVTControlCharacters(message).split('\n')[0] ?? '';

/** Every spec in the report, describe blocks included. */
export const specsIn = (suites: readonly ReportSuite[]): readonly ReportSpec[] =>
  suites.flatMap((suite) => [...suite.specs, ...specsIn(suite.suites ?? [])]);

/**
 * Every way a run against the empty page can fail to show the suite is alive,
 * as readable lines.
 *
 * `requests` is how many requests the empty page answered. None means the specs
 * ran against something else, and whatever they failed against proves nothing.
 */
export function findLivenessProblems(report: LivenessReport, requests: number): readonly string[] {
  const problems: string[] = [];

  if (report.errors.length > 0) {
    problems.push(
      'Playwright reported an error outside any spec:',
      ...report.errors.map((error) => `  ${firstLine(error.message)}`),
    );
  }

  const specs = specsIn(report.suites);
  if (specs.length === 0) {
    problems.push('no specs ran, so none was shown to fail. Check testDir in playwright.config.ts.');
  }

  const inSpecDirectory = ({ location }: ReportError): boolean => {
    if (location === undefined) return false;
    const relative = path.relative(report.config.rootDir, location.file);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  };

  for (const spec of specs) {
    const name = `${spec.file}:${String(spec.line)} ${spec.title}`;

    for (const test of spec.tests) {
      if (test.status === 'skipped') {
        problems.push(`was skipped, so it asserts nothing: ${name}`);
        continue;
      }
      // `expected` passed outright; `flaky` failed first and then passed.
      if (test.status !== 'unexpected') {
        problems.push(`passed against an empty page, so it asserts nothing the app provides: ${name}`);
        continue;
      }
      const outside = test.results.find((result) => !result.errors.some(inSpecDirectory));
      if (outside !== undefined) {
        problems.push(
          `failed outside the spec, so its own assertions never ran: ${name}`,
          ...outside.errors.slice(0, 1).map((error) => `  ${firstLine(error.message)}`),
        );
      }
    }
  }

  if (requests === 0) {
    problems.push('the empty page was never requested, so the specs did not run against it.');
  }

  return problems;
}

/**
 * Runs the suite against the empty page and returns the problems with that run.
 * The server and the report file are cleaned up whatever happens.
 */
async function runAgainstEmptyPage(repoRoot: string): Promise<readonly string[]> {
  let requests = 0;
  const server = createServer((request, response) => {
    requests += 1;
    response.writeHead(request.url === '/' ? 200 : 404, { 'content-type': 'text/html' }).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  const directory = mkdtempSync(path.join(tmpdir(), 'e2e-liveness-'));
  const reportFile = path.join(directory, 'report.json');

  try {
    // Retries off, because a spec that fails and then passes on a retry is
    // exactly what this is looking for. --forbid-only, because `test.only`
    // would quietly shrink the suite to one spec.
    const exitStatus = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        path.join(repoRoot, 'node_modules', '.bin', 'playwright'),
        ['test', '--retries=0', '--forbid-only', '--reporter=json'],
        {
          cwd: repoRoot,
          stdio: 'inherit',
          env: {
            ...process.env,
            E2E_BASE_URL: `http://127.0.0.1:${String(port)}`,
            PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
          },
        },
      );
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (!existsSync(reportFile)) {
      return [`Playwright wrote no report (exit status ${String(exitStatus)}).`];
    }

    const report = JSON.parse(readFileSync(reportFile, 'utf8')) as LivenessReport;
    const problems = findLivenessProblems(report, requests);
    if (problems.length === 0) {
      console.log(
        `E2E gate is alive: all ${String(specsIn(report.suites).length)} specs failed against an empty page, each on a line of its own.`,
      );
    }
    return problems;
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const problems = await runAgainstEmptyPage(path.resolve(import.meta.dirname, '..'));
  if (problems.length > 0) {
    console.error(['E2E gate is NOT alive:', ...problems].join('\n'));
    process.exitCode = 1;
  }
}
