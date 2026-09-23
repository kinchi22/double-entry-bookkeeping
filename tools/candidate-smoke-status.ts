import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const CONTEXT = 'Candidate Production smoke';

type Payload = { git?: { sha?: unknown }; url?: unknown };

function payload(): Payload {
  const raw = process.env['EVENT_PAYLOAD'];
  if (raw === undefined) throw new Error('The Vercel ready-event payload is missing.');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The Vercel ready-event payload must be an object.');
  }
  return parsed;
}

function publish(sha: string, state: string, description: string): void {
  const repository = process.env['GITHUB_REPOSITORY'];
  if (repository === undefined || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid.');
  }
  const runId = process.env['GITHUB_RUN_ID'];
  const args = [
    'api', '-X', 'POST', `repos/${repository}/statuses/${sha}`,
    '-f', `state=${state}`, '-f', `context=${CONTEXT}`, '-f', `description=${description}`,
  ];
  if (runId !== undefined) args.push('-f', `target_url=https://github.com/${repository}/actions/runs/${runId}`);
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(`Failed to publish ${state} candidate status: ${result.stderr}`);
}

function main(): void {
  const command = process.argv[2];
  if (command !== 'pending' && command !== 'success' && command !== 'failure') {
    throw new Error('Expected pending, success or failure.');
  }
  const event = payload();
  const sha = event.git?.sha;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('The Vercel ready event must include a valid git.sha; no status can be attributed without it.');
  }
  const url = event.url;
  if (typeof url !== 'string' || !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url)) {
    publish(sha, 'failure', 'The Vercel ready event has no valid deployment URL.');
    throw new Error('The Vercel ready event must include a valid HTTPS url.');
  }
  publish(sha, command, command === 'pending'
    ? 'Waiting for Production readiness and candidate smoke.'
    : command === 'success' ? 'Candidate Production smoke passed.' : 'Candidate Production smoke failed.');
  if (command === 'pending') {
    const output = process.env['GITHUB_OUTPUT'];
    if (output !== undefined && output !== '') appendFileSync(output, `sha=${sha}\nurl=${url}\n`);
  }
}

main();
