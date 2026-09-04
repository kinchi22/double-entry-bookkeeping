import { type ReactNode } from 'react';

export type StatusTone = 'positive' | 'negative';

export type StatusDotProps = {
  readonly tone: StatusTone;
  readonly label: string;
};

/**
 * Tone is an abstract signal, not a domain concept. The caller decides what
 * "positive" means; this component only decides what it looks like.
 *
 * The label is rendered as text rather than conveyed by color alone, so the
 * status survives both a screen reader and a colorblind reader.
 */
export function StatusDot({ tone, label }: StatusDotProps): ReactNode {
  const toneClass = tone === 'positive' ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${toneClass}`} />
      <span>{label}</span>
    </span>
  );
}
