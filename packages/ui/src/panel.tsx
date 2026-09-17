import { useId, type ReactNode } from 'react';

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
  // The title names the section, which is what makes it a region a reader can
  // find by name, rather than an anonymous box.
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-neutral-300 p-4">
      <h2
        id={titleId}
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
