export const tailwindPreset = {
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontFeatureSettings: {
        tabular: '"tnum" 1',
      },
    },
  },
};

export default tailwindPreset;
