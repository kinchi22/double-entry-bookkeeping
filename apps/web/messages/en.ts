/**
 * Every string a person reads in this app, in English.
 *
 * A plain object, read by import: English is the only locale that ships, and a
 * translation library for one locale is a dependency with nothing to decide.
 * ADR-0007 records what replaces this import once a second locale is scheduled.
 *
 * The shape is the one that replacement reads. One namespace per component
 * that renders copy, keys in English, values plain strings, so the catalogue
 * carries over as it is. `repo/no-inline-copy` is what keeps copy from being
 * written anywhere else.
 *
 * `healthPanel.checkedAt` is a prefix rendered before the instant. A language
 * that puts the instant first needs it as one message with an argument, which
 * a plain string cannot express; that change belongs to the adoption.
 */
export const en = {
  app: {
    name: 'Double Entry Bookkeeping',
    description: 'Double-entry bookkeeping.',
  },
  healthPanel: {
    title: 'Pipeline health',
    reachable: 'reachable',
    unreachable: 'unreachable',
    checkedAt: 'checked at',
  },
  refreshButton: {
    idle: 'Re-check',
    pending: 'Checking...',
  },
} as const;
