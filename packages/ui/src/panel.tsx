import { type ReactNode } from 'react';

export type PanelProps = {
  readonly title: string;
  readonly children: ReactNode;
};

/**
 * A titled container. It knows nothing about ledgers, accounts, or amounts --
 * the design system stays domain-agnostic so it can be extracted or reused, and
 * so a rename in the domain never ripples into presentation.
 */
export function Panel({ title, children }: PanelProps): ReactNode {
  return (
    <section className="rounded-lg border border-neutral-300 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
        {title}
      </h2>
      {children}
    </section>
  );
}
