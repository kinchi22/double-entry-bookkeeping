import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const VIOLATIONS_DIR = path.join(REPO_ROOT, 'fixtures', 'violations');

export type GateRun = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export function bin(name: string): string {
  return path.join(REPO_ROOT, 'node_modules', '.bin', name);
}

export function runGate(command: string, args: readonly string[], cwd: string): GateRun {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });

  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
