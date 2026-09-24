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
  entrySearch: {
    title: 'Search entries',
    from: 'From',
    to: 'To',
    account: 'Account',
    anyAccount: 'Any account',
    memo: 'Memo',
    submit: 'Search',
    results: 'Results',
    nothingMatched: 'Nothing matched what you asked for.',
    refused:
      'That search was not run. Check the day range -- each day is a calendar day, and From cannot be later than To -- that the account is one of those listed, and that the memo is no longer than a memo can be.',
    backToEntries: 'Back to entries',
  },
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
