/**
 * Every string a person reads in this app, in English.
 *
 * A plain object, read by import: English is the only locale that ships, and a
 * translation library for one locale is a dependency with nothing to decide.
 * ADR-0007 says why; ADR-0008 records what replaces this import once a second
 * locale is scheduled.
 *
 * The shape is the one that replacement reads: copy grouped by the part of the
 * UI that renders it, keys in English, values plain strings, so the catalogue
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
  home: {
    entriesLink: 'Entries',
  },
  signInPage: {
    title: 'Sign in',
    google: 'Sign in with Google',
    failed: 'Signing in did not work. Try again.',
  },
  /** The test sign-in: only where `AUTH_TEST_LOGIN` is set. ADR-0021. */
  testSignIn: {
    title: 'Test sign-in',
    identifier: 'Identifier',
    submit: 'Sign in',
  },
  signOut: {
    submit: 'Sign out',
  },
  entriesPage: {
    title: 'Entries',
    search: 'Search',
  },
  /**
   * The Entry search, `/entries/search`. `refused` covers every way criteria
   * can be refused, because they are refused with one code: a day that is not
   * a calendar day, a range the wrong way round, and an Account no chart of
   * accounts holds are all `INVALID_INPUT`, and a message that named only one
   * of them would be wrong for the others.
   *
   * `anyAccount` is the Account criterion's explicit default, so dropping it is
   * a choice in the list rather than an empty box.
   */
  entrySearch: {
    title: 'Search entries',
    from: 'From',
    to: 'To',
    account: 'Account',
    anyAccount: 'Any account',
    submit: 'Search',
    results: 'Results',
    nothingMatched: 'Nothing matched what you asked for.',
    refused:
      'That search was not run. Check the day range -- each day is a calendar day, and From cannot be later than To -- and that the account is one of those listed.',
    backToEntries: 'Back to entries',
  },
  /**
   * `line` is a prefix rendered before the line's number, as `checkedAt` is
   * before an instant, and needs the same rewrite for a language that orders
   * them differently.
   */
  entryForm: {
    title: 'New entry',
    date: 'Date',
    memo: 'Memo',
    line: 'Line',
    account: 'Account',
    chooseAccount: 'Choose an account',
    side: 'Side',
    amount: 'Amount',
    submit: 'Add entry',
    pending: 'Adding...',
    unbalanced: 'Debits and credits must balance. Check the amount on each side.',
    invalid: 'The entry was not added. Check the date, the memo and each line.',
    unavailable: 'The entry could not be saved just now. Try again.',
    signedOut: 'You are signed out. Sign in again to add an entry.',
  },
  entryList: {
    title: 'Entries',
    empty: 'No entries yet.',
    total: 'Total',
  },
  /** One name per code in the chart of accounts. ADR-0010. */
  accounts: {
    cash: 'Cash',
    payable: 'Accounts payable',
    capital: 'Capital',
    sales: 'Sales',
    expense: 'Expenses',
  },
  sides: {
    debit: 'Debit',
    credit: 'Credit',
  },
} as const;
