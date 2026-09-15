import { Panel, StatusDot } from '@repo/ui';
import { type ReactNode } from 'react';
import { RefreshButton } from '../../components/refresh-button';
import { en } from '../../messages/en';
import { createContext } from '../../server/context';
import { createCaller } from '../../server/root-router';
import { recheckHealth } from './actions';

// The page performs IO, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

/**
 * Composition only. The page calls one procedure and renders the result; it
 * contains no rule about what healthy means.
 */
export default async function HomePage(): Promise<ReactNode> {
  const caller = createCaller(createContext());
  const health = await caller.health.get();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">{en.app.name}</h1>

      <Panel title={en.healthPanel.title}>
        <div className="flex flex-col gap-2" data-testid="health">
          <StatusDot
            tone={health.status === 'healthy' ? 'positive' : 'negative'}
            label={health.status}
          />
          <ul className="text-sm text-neutral-600">
            {health.components.map((component) => (
              <li key={component.name} data-testid={`component-${component.name}`}>
                {component.name}:{' '}
                {component.reachable ? en.healthPanel.reachable : en.healthPanel.unreachable}
              </li>
            ))}
          </ul>
          {/*
            The instant arrives as an ISO string, because that is what the
            contract carries. Rendering it raw keeps the page free of a
            formatting policy nobody has decided yet.
          */}
          <time
            className="text-xs text-neutral-500"
            dateTime={health.checkedAt}
            data-testid="checked-at"
          >
            {en.healthPanel.checkedAt} {health.checkedAt}
          </time>
          <RefreshButton action={recheckHealth} />
        </div>
      </Panel>
    </main>
  );
}
