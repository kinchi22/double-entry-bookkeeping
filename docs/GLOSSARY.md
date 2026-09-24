# Glossary

One canonical name per concept. No synonyms. If a new concept needs a name, add
it here in the same commit that introduces it.

This table is the domain's: what the product is built from. The words for how it
is worked on -- Harness, Working agreement, Skill, Driver, Implementer, Subagent
and Agent worktree -- are in `docs/agents/harnesses.md` instead, in a table of
their own. Between them they are still one index, because no term is defined in
both.

| Term             | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| ADR              | A numbered file under `docs/adr/` holding an architectural decision that is hard to reverse, surprising without context and the result of a real trade-off. Indexed from `docs/ARCHITECTURE.md`. |
| Account          | What an Entry line is posted against, named by a code from the Chart of accounts. |
| Adapter          | A concrete implementation of a Port. The only place infrastructure appears.  |
| Aggregate        | The entity a repository loads and saves as one thing, together with the entities it owns. An Entry owns its Entry lines. A write of one aggregate is atomic; ADR-0011. |
| Auth context     | Who a request is made by: the User its Session belongs to, or nobody. A controller resolves it from the session cookie and passes it on; a use case that touches a User's data checks it at its entry point, and without a User answers `UNAUTHENTICATED`, mapped to 401. ADR-0021. |
| Balanced         | The property that makes an Entry postable: its debit amounts sum to its credit amounts. Checked in `domain/`, never in SQL. |
| Branded type     | A primitive carrying a compile-time name, so two `number`s stop being interchangeable. Erased at runtime. |
| Chart of accounts | The set of Accounts an Entry line may name. A constant in `domain/` today -- `cash`, `payable`, `capital`, `sales`, `expense` -- until ADR-0015 is adopted. |
| Component        | A checked dependency of the system, as reported by the health slice.         |
| Composition root | `apps/web/server/container.ts`. The only place implementations are chosen.   |
| Contract         | A zod schema plus its inferred type, in `packages/contracts`.                |
| Copy             | Text a person reads in the UI, page metadata included. Lives in the message catalogue, never inline. `repo/no-inline-copy` catches it written as a literal; ADR-0007 lists what that misses. |
| Current Production | The Production deployment the production domains route to, and so the one receiving production traffic. It changes only by Promotion or a rollback. ADR-0024. |
| Deferred         | The status of an ADR whose decision is taken and deliberately not built. Not a rule, and not an open question. |
| Deployment Check | A check Vercel requires on a Production deployment's commit before Promotion. A Vercel setting, seen by no gate here; `docs/ARCHITECTURE.md`, "How a release reaches Production", lists them. ADR-0024. |
| Domain error     | A failure value carrying a stable `DomainErrorCode`. Never an exception.     |
| E2E liveness     | The check that every spec fails against an empty page, each on a line of its own, so a spec that asserts nothing cannot land green. Decided by `tools/verify-e2e-liveness.ts`, run in `Gate liveness`. ADR-0006. |
| Entry            | One posting: a calendar day, a memo, and two or more Entry lines that balance. The brief's word "record" means this and is not used. |
| Entry line       | One line of an Entry: an Account, a Side, and an amount greater than zero. |
| Entry search     | A read of one User's Entries narrowed by Search criteria, rendered at `/entries/search`. The issue's word "history" means this and is not used. The port method, the use case and the procedure are all named for it, and listing every Entry is an Entry search with no criterion. |
| Entry total      | The sum of an Entry's debit amounts, which is the sum of its credit amounts because the Entry is Balanced. Computed in `domain/`; never summed by a client. |
| Force Promote    | Vercel's control for promoting a Production deployment past failed Deployment Checks. Prohibited while a migration is pending or failed; allowed only as the emergency roll-forward in `docs/DEPLOYMENT.md`. ADR-0024. |
| Human review surface | The paths a person approves: `e2e/`, `packages/db/drizzle/`, `.github/`, `stryker.config.ts`. Declared in `.github/CODEOWNERS`, justified in ADR-0002 and ADR-0004. |
| Identity         | One way a User signs in: a provider and that provider's subject for the person, such as Google's `sub`. A User is found by its Identity, never by its email. Never called an account: Account already means what an Entry line is posted against. ADR-0021. |
| Logger           | The port an Adapter reports an infrastructure failure through: an event name such as `entries.search_failed`, fields, and a message. A field holds a primitive or an `ErrorDescription`, which is branded so an error reaches the logger only as `describeError` describes it. ADR-0018. |
| Message catalogue | `apps/web/messages/{locale}.ts`: the copy for one locale, a plain object keyed in English, grouped by the part of the UI that renders it. `en.ts` is the only one until ADR-0008 is adopted. |
| Milestone branch | `milestone/<name>`, one per acceptance criterion. Its specs land first and are owner-reviewed; feature branches merge into it; it reaches `main` once they are green. |
| Minor units      | The smallest denomination an amount is counted in. Scale 0 today, so one minor unit is one whole unit: no decimal places, no currency symbol, grouping applied only at display. |
| Money            | A branded integer count of minor units. Built and combined only through `@repo/core/money`. |
| Port             | An interface stated in domain terms that the application layer depends on.   |
| Preview          | The Vercel deployment of a pull request's commit, against the one shared preview Neon project, which only `main` migrates. Best effort: never smoke-run and read by no gate, so one that needs an unmerged migration may fail at runtime. ADR-0024. |
| Production       | The Vercel environment `main` deploys to, against the production Neon project. Not "staging": there is none. Its data is disposable until the MVP ships. Never alone the name of a deployment: say Production deployment or Current Production. ADR-0024. |
| Production deployment | An artifact Vercel built for a `main` commit with the Production environment's configuration. It exists; it receives traffic only once promoted. ADR-0024. |
| Promotion        | Assigning the production domains to a Production deployment, which makes it Current Production. Automatic once its Deployment Checks pass. ADR-0024. |
| Public surface   | The entry points a package lists in its `exports` field.                     |
| Shared kernel    | Vocabulary several features depend on, held in `core/src/<name>/domain` with no ports or adapters. `money` is the only one. |
| Result           | `Ok<T>` or `Err<E>`. The return type of any domain operation that can fail. |
| Search criteria  | What an Entry search is narrowed by: an inclusive range of calendar days, an Account any one line names, and a substring of the memo. Each is optional and an absent one matches every Entry; those present combine with `and`. Carried in the URL's query, shape parsed in `contracts`, and everything that needs the model -- the Account being one the Chart of accounts holds, `from` no later than `to`, and a memo term trimmed and no longer than a memo -- decided in `domain/` as an Entry's rules are. A memo term is matched literally, so a wildcard in it is a character to find. |
| Server Action    | The app's write path. Parses input, invokes a use case through `createCaller`, invalidates what it made stale. |
| Session          | A User's signed-in state: a random token in an `HttpOnly` cookie, stored in `sessions` only as its SHA-256 hash, with an expiry that slides, except the Smoke User's. Signing out deletes it. ADR-0021. |
| Side             | The direction of an Entry line, `debit` or `credit`. The amount never carries it. |
| Smoke run        | The Smoke-tagged specs against a deployed URL, at one of three seams: Current Production after a migration, a candidate Production deployment before Promotion, and Current Production after it. Not a merge gate; that is `E2E build`. ADR-0006, ADR-0024. |
| Smoke tag        | `{ tag: '@smoke' }` on a spec, the allowlist the Smoke run filters by. Only a read may carry it: an untagged spec never runs against Production. |
| Smoke User       | The User the Smoke run reads Production as. It has no Identity, owns a fixed set of Entries, and its one Session is the `SMOKE_SESSION_TOKEN` secret. ADR-0021. |
| Spec isolation   | The rule that one pull request changes `e2e/` or the rest of the repository, never both. Decided by `tools/check-pr-isolation.ts`. |
| Test collection  | The set of test files a vitest project actually runs. Compared against the working tree by `tools/gates/test-collection-gate.test.ts`, so a test nothing runs fails CI. |
| Test sign-in     | A form on `/sign-in` that signs in by an identifier alone, where `AUTH_TEST_LOGIN` is set: `E2E build`, Preview, a local server, never Production. One identifier is one User, with an Identity of provider `test`. ADR-0021. |
| Trigger          | The condition that would adopt a Deferred ADR, stated in that ADR.           |
| Unbalanced       | The `DomainErrorCode` for an Entry whose debits and credits differ. The one broken Entry rule with a code of its own, so the form can say the balance is what is wrong; every other broken rule is `INVALID_INPUT`. Mapped to `UNPROCESSABLE_CONTENT`. |
| User             | A person who keeps books here, created the first time they sign in. Every Entry belongs to one User, and no User sees another's. ADR-0021. |
| Use case         | One application operation. Owns orchestration, and any transaction boundary wider than one Aggregate. ADR-0011. |

## Naming rules

- Source is English-only, enforced by the `repo/no-non-ascii` lint rule.
- Copy lives in `apps/web/messages/en.ts`, never inline. The
  `repo/no-inline-copy` lint rule rejects it written as a literal. Catalogue keys
  are English, and `en` is the default locale.
