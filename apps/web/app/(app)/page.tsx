import { Panel, StatusDot } from '@repo/ui';
import { type ReactNode } from 'react';
import { RefreshButton } from '../../components/refresh-button';
import { createContext } from '../../server/context';
import { createCaller } from '../../server/root-router';

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
      <h1 className="text-xl font-semibold">Double Entry Bookkeeping</h1>

      <Panel title="Pipeline health">
        <div className="flex flex-col gap-2" data-testid="health">
          <StatusDot
            tone={health.status === 'healthy' ? 'positive' : 'negative'}
            label={health.status}
          />
          <ul className="text-sm text-neutral-600">
            {health.components.map((component) => (
              <li key={component.name} data-testid={`component-${component.name}`}>
                {component.name}: {component.reachable ? 'reachable' : 'unreachable'}
              </li>
            ))}
          </ul>
          <RefreshButton />
        </div>
      </Panel>
    </main>
  );
}
