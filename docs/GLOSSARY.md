# Glossary

One canonical name per concept. No synonyms. If a new concept needs a name, add
it here in the same commit that introduces it.

| Term             | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| ADR              | A numbered file under `docs/adr/` holding one decision: the problem, the decision, its consequences and the rejected alternatives. Indexed from `docs/ARCHITECTURE.md`. |
| Adapter          | A concrete implementation of a Port. The only place infrastructure appears.  |
| Branded type     | A primitive carrying a compile-time name, so two `number`s stop being interchangeable. Erased at runtime. |
| Component        | A checked dependency of the system, as reported by the health slice.         |
| Composition root | `apps/web/server/container.ts`. The only place implementations are chosen.   |
| Contract         | A zod schema plus its inferred type, in `packages/contracts`.                |
| Copy             | Text a person reads in the UI, page metadata included. Lives in the message catalogue, never inline. `repo/no-inline-copy` catches it written as a literal; ADR-0007 lists what that misses. |
| Deferred         | The status of an ADR whose decision is taken and deliberately not built. Not a rule, and not an open question. |
| Domain error     | A failure value carrying a stable `DomainErrorCode`. Never an exception.     |
| E2E liveness     | The check that every spec fails against an empty page, each on a line of its own, so a spec that asserts nothing cannot land green. Decided by `tools/verify-e2e-liveness.ts`, run in `Gate liveness`. ADR-0006. |
| Human review surface | The paths a person approves: `e2e/`, `packages/db/drizzle/`, `.github/`. Declared in `.github/CODEOWNERS`, justified in ADR-0002. |
| Message catalogue | `apps/web/messages/{locale}.ts`: the copy for one locale, a plain object keyed in English, grouped by the part of the UI that renders it. `en.ts` is the only one until ADR-0008 is adopted. |
| Milestone branch | `milestone/<name>`, one per acceptance criterion. Its specs land first and are owner-reviewed; feature branches merge into it; it reaches `main` once they are green. |
| Minor units      | The smallest denomination an amount is counted in. Scale 0 today, so one minor unit is one whole unit: no decimal places, no currency symbol, grouping applied only at display. |
| Money            | A branded integer count of minor units. Built and combined only through `@repo/core/money`. |
| Port             | An interface stated in domain terms that the application layer depends on.   |
| Preview          | The Vercel deployment of a pull request's commit, against the preview Neon project. Never smoke-run. ADR-0009. |
| Production       | The Vercel deployment a merge to `main` produces, against the production Neon project. Not "staging": there is none. Its data is disposable until the MVP ships. ADR-0009. |
| Public surface   | The entry points a package lists in its `exports` field.                     |
| Shared kernel    | Vocabulary several features depend on, held in `core/src/<name>/domain` with no ports or adapters. `money` is the only one. |
| Result           | `Ok<T>` or `Err<E>`. The return type of any domain operation that can fail. |
| Server Action    | The app's write path. Parses input, invokes a use case through `createCaller`, invalidates what it made stale. |
| Smoke run        | The `E2E` job: the specs against a Production deployment after it is live. Not a merge gate; that is `E2E build`. ADR-0006, ADR-0009. |
| Spec isolation   | The rule that one pull request changes `e2e/` or the rest of the repository, never both. Decided by `tools/check-pr-isolation.ts`. |
| Test collection  | The set of test files a vitest project actually runs. Compared against the working tree by `tools/gates/test-collection-gate.test.ts`, so a test nothing runs fails CI. |
| Trigger          | The condition that would adopt a Deferred ADR, stated in that ADR.           |
| Use case         | One application operation. Owns orchestration and the transaction boundary.  |

## Naming rules

- Source is English-only, enforced by the `repo/no-non-ascii` lint rule.
- Copy lives in `apps/web/messages/en.ts`, never inline. The
  `repo/no-inline-copy` lint rule rejects it written as a literal. Catalogue keys
  are English, and `en` is the default locale.
