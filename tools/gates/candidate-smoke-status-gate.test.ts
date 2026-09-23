import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './run-gate';

const SHA = 'a'.repeat(40);

function runStatus(commands: string | readonly string[], payload: unknown) {
  const directory = mkdtempSync(path.join(tmpdir(), 'candidate-smoke-'));
  const calls = path.join(directory, 'calls');
  const fakeGh = path.join(directory, 'gh');
  writeFileSync(fakeGh, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\n', { mode: 0o755 });
  try {
    let result;
    for (const command of typeof commands === 'string' ? [commands] : commands) {
      result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools/candidate-smoke-status.ts'), command], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env['PATH'] ?? ''}`,
          CALLS: calls,
          GITHUB_REPOSITORY: 'owner/repo',
          EVENT_PAYLOAD: JSON.stringify(payload),
          GITHUB_RUN_ID: '123',
        },
      });
      if (result.status !== 0) break;
    }
    if (result === undefined) throw new Error('A status command is required.');
    return { result, calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '' };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('candidate smoke status CLI', () => {
  const payload = {
    environment: 'production',
    git: { sha: SHA },
    url: 'https://candidate.vercel.app',
  };

  it.each(['pending', 'success', 'failure'])('publishes %s on the event SHA', (state) => {
    const { result, calls } = runStatus(state, payload);
    expect(result.status, result.stderr).toBe(0);
    expect(calls).toContain(`repos/owner/repo/statuses/${SHA}`);
    expect(calls).toContain(`state=${state}`);
    expect(calls).toContain('context=Candidate Production smoke');
  });

  it.each(['success', 'failure'])('moves from pending to %s on the same SHA', (outcome) => {
    const { result, calls } = runStatus(['pending', outcome], payload);
    expect(result.status, result.stderr).toBe(0);
    expect(calls.match(new RegExp(`repos/owner/repo/statuses/${SHA}`, 'g'))).toHaveLength(2);
    expect(calls.indexOf('state=pending')).toBeLessThan(calls.indexOf(`state=${outcome}`));
  });

  it('publishes failure when the deployment URL is missing', () => {
    const { result, calls } = runStatus('pending', { environment: 'production', git: { sha: SHA } });
    expect(result.status).not.toBe(0);
    expect(calls).toContain(`repos/owner/repo/statuses/${SHA}`);
    expect(calls).toContain('state=failure');
  });

  it('rejects a missing SHA without attributing status to the workflow commit', () => {
    const { result } = runStatus('pending', { environment: 'production', url: payload.url });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('git.sha');
  });

  it.each([
    ['preview', 'pending'],
    ['preview', 'success'],
  ] as const)(
    'refuses a %s ready event at the %s transition without publishing a candidate status',
    (environment, state) => {
      const { result, calls } = runStatus(state, { ...payload, environment });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('production environment');
      expect(calls).toBe('');
    },
  );

  it('publishes failure on the event SHA when environment is missing', () => {
    const { result, calls } = runStatus('pending', { git: { sha: SHA }, url: payload.url });
    expect(result.status).not.toBe(0);
    expect(calls).toContain(`repos/owner/repo/statuses/${SHA}`);
    expect(calls).toContain('state=failure');
    expect(calls).not.toContain('state=pending');
  });
});
