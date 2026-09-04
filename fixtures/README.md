# Violation fixtures

Writing a rule and having a working rule are different things. In a monorepo,
path and alias resolution break silently all the time: an element pattern that
matches nothing does not fail loudly, it just stops checking. Every rule in this
repo was verified by breaking it on purpose, and this directory keeps those
deliberate breakages so a rule that dies later surfaces immediately.

Each file below is written to break one named rule. `tools/gates/` asserts that
the corresponding gate actually reports it. If a fixture stops failing, the gate
is dead and CI fails -- which is the point. Some fixtures trip a second rule as a
side effect (an unresolvable import is also an unresolvable import to
dependency-cruiser); only the named rule is asserted.

`tools/gates/fixture-map.ts` is the list. It is read from two directions:
`lint-gate.test.ts` and `dep-cruise-gate.test.ts` check every row still fires,
and `rule-coverage-gate.test.ts` checks the shipped configuration has no rule
missing from the list. Adding a rule without adding a fixture therefore fails CI
instead of passing unnoticed.

Nothing here is part of the product build: the root ESLint config, tsconfig,
dependency-cruiser config, jscpd config, and Vitest unit project all exclude it.

## ESLint

| Fixture                                          | Rule that must fire                              |
| ------------------------------------------------ | ------------------------------------------------ |
| `violations/.../domain/imports-adapters.ts`      | `boundaries/dependencies`                        |
| `violations/.../adapters/imports-web.ts`         | `boundaries/dependencies`                        |
| `violations/.../domain/imports-unknown.ts`       | `boundaries/no-unknown-dependencies`             |
| `violations/.../domain/imports-drizzle.ts`       | `no-restricted-imports` (ORM)                    |
| `violations/.../domain/imports-uuid.ts`          | `no-restricted-imports` (id generation)          |
| `violations/.../domain/uses-fetch.ts`            | `no-restricted-globals`                          |
| `violations/.../domain/uses-process-env.ts`      | `no-restricted-properties`                       |
| `violations/.../domain/throws.ts`                | `no-restricted-syntax` (throw)                   |
| `violations/.../domain/dynamic-import.ts`        | `no-restricted-syntax` (import())                |
| `violations/.../domain/non-ascii.ts`             | `repo/no-non-ascii`                              |
| `violations/.../domain/explicit-any.ts`          | `@typescript-eslint/no-explicit-any`             |
| `violations/.../domain/value-type-import.ts`     | `@typescript-eslint/consistent-type-imports`     |
| `violations/.../domain/untyped-boundary.ts`      | `@typescript-eslint/explicit-module-boundary-types` |
| `violations/.../domain/unused-binding.ts`        | `@typescript-eslint/no-unused-vars`              |
| `violations/apps/web/server/routers/fat-handler.ts`     | `max-lines-per-function`                  |
| `violations/apps/web/server/routers/branchy-handler.ts` | `complexity`                              |

## dependency-cruiser

| Fixture                                          | Rule that must fire           |
| ------------------------------------------------ | ----------------------------- |
| `violations/.../domain/cycle-a.ts` + `cycle-b`   | `no-circular`                 |
| `violations/.../domain/orphan.ts`                | `no-orphans`                  |
| `violations/.../domain/imports-adapters.ts`      | `domain-is-pure`              |
| `violations/.../application/uses-adapter.ts`     | `application-not-to-adapters` |
| `violations/.../application/uses-db.ts`          | `only-adapters-touch-db`      |
| `violations/.../adapters/imports-web.ts`         | `core-not-to-app`             |
| `violations/packages/contracts/src/imports-core.ts` | `contracts-is-a-leaf`      |
| `violations/packages/ui/src/imports-core.ts`     | `ui-is-domain-agnostic`       |
| `violations/apps/web/server/uses-db.ts`          | `web-not-to-db`               |
| `violations/.../domain/imports-unknown.ts`       | `not-to-unresolvable`         |

## Other gates

| Fixture                                          | Gate that must fail   |
| ------------------------------------------------ | --------------------- |
| `violations/apps/web/server/deep-import.ts`      | typecheck (exports)   |
| `server-only/client-imports-server.tsx`          | build (server-only)   |
| `mutation/`                                       | Stryker threshold     |
| `migration/schema-with-a-table.ts`               | migration drift (`pnpm db:drift`) |

## Rules with no fixture

Two rules are deliberately uncovered, and `rule-coverage-gate.test.ts` fails if
the reason is ever deleted without a fixture replacing it. Both are unreachable
rather than unwritten:

- `boundaries/no-unknown-files` -- every root in `boundaries/include` already has
  a catch-all element, so no included file can fail to classify. The rule guards
  a future `include` entry added without a matching element. Reaching it would
  mean weakening the shared config, which would stop testing what ships.
- `no-dev-dep-in-src` (dependency-cruiser) -- the fixture tree has no
  `node_modules` of its own, so external imports resolve up into the repo root
  `node_modules`, which the shipped config excludes from the graph. The
  dependency is dropped before the rule sees it.

## Fixtures that are planted, not linted

`server-only/client-imports-server.tsx` and `migration/schema-with-a-table.ts`
are copied into `apps/web` and `packages/db` respectively, checked, and removed
again in a `finally` block. Both have to run from inside the real package,
because what they break is a build rather than a lint pass, and both tools
resolve their imports from wherever the file sits.

## Support files

Not violations. They exist so a fixture has something local to import instead of
reaching across a boundary and breaking an unrelated rule:
`domain/amount.ts`, `adapters/repository.ts`, `apps/web/server/handler.ts`,
`packages/db/src/index.ts`.
