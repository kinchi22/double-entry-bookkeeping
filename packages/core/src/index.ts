/**
 * Runtime-agnostic surface of @repo/core.
 *
 * Safe from any runtime: pure domain logic, use case factories, and port types.
 * Nothing reachable from here touches a database, a network, or React.
 */
export {
  evaluateHealth,
  createGetHealth,
  type ComponentReport,
  type HealthReport,
  type GetHealth,
  type GetHealthDependencies,
  type HealthProbe,
} from './health/index';

export {
  MONEY_ZERO,
  addMoney,
  isZeroMoney,
  money,
  moneyToMinorUnits,
  negateMoney,
  sumMoney,
} from './money/index';

export {
  CHART_OF_ACCOUNTS,
  MEMO_MAX_LENGTH,
  isAccountCode,
  makeEntry,
  type AccountCode,
  type Entry,
  type EntryDraft,
  type EntryLine,
  type EntryStamp,
  createPostEntry,
  type PostEntry,
  type PostEntryDependencies,
  createListEntries,
  type ListEntries,
  type ListEntriesDependencies,
  type EntryRepository,
} from './entries/index';

export {
  describeError,
  type ErrorDescription,
  type LogFields,
  type LogValue,
  type Logger,
} from './logging/index';
