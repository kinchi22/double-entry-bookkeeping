import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';
import { isAccountCode, memoLength, MEMO_MAX_LENGTH, type AccountCode } from './entry';

export type SearchCriteriaDraft = {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly account?: string | undefined;
  readonly memo?: string | undefined;
};

export type SearchCriteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: AccountCode;
  readonly memo?: string;
};

export const NO_CRITERIA: SearchCriteria = {};

export function makeSearchCriteria(draft: SearchCriteriaDraft): Result<SearchCriteria, DomainError> {
  const { from, to, account } = draft;
  const memo = draft.memo === undefined ? '' : draft.memo.trim();
  if (account !== undefined && !isAccountCode(account)) {
    return err(
      domainError('INVALID_INPUT', `No account named ${account} is in the chart of accounts.`),
    );
  }
  if (from !== undefined && to !== undefined && from > to) {
    return err(
      domainError('INVALID_INPUT', `A day range cannot end (${to}) before it starts (${from}).`),
    );
  }

  if (memoLength(memo) > MEMO_MAX_LENGTH) {
    return err(
      domainError(
        'INVALID_INPUT',
        `A memo term can be at most ${String(MEMO_MAX_LENGTH)} characters, the length of a memo.`,
      ),
    );
  }

  return ok({
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(account === undefined ? {} : { account }),
    ...(memo === '' ? {} : { memo }),
  });
}
