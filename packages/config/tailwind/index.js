/**
 * Shared Tailwind preset.
 *
 * Design tokens live here rather than in apps/web, so packages/ui and the app
 * cannot drift into two different scales. packages/ui stays domain-agnostic;
 * this file is the only place a raw color or spacing value is allowed to be
 * named.
 */
export const tailwindPreset = {
  theme: {
    extend: {
      fontFamily: {
        // Numeric alignment matters for a ledger. Tabular figures are not a
        // preference here, they are a correctness aid when scanning a column.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontFeatureSettings: {
        tabular: '"tnum" 1',
      },
    },
  },
};

export default tailwindPreset;
