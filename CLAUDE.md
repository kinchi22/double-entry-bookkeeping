# Working agreement

Read `docs/ARCHITECTURE.md` before changing anything structural.

## Non-negotiable

- **If unsure, ask.** Any design decision not already fixed in
  `docs/ARCHITECTURE.md`, or in an `Accepted` ADR under `docs/adr/`, requires
  stopping and asking, not inventing. A `Deferred` ADR is neither: the decision
  is taken and deliberately not built. Read it before designing anything in that
  area, and stop and ask before building it -- being decided does not authorise
  the work.
- **No new npm dependencies** without proposing them first, with a reason.
- **Search before writing.** Duplicate reimplementation is the most common
  failure mode in this repo.
- **Introduce an interface only when there are two or more implementations.**
  No speculative abstraction.
- **Tests assert behaviour, not mocks.** A test that only checks a spy was
  called will be rejected by the mutation threshold, and the fixture in
  `fixtures/mutation/` shows exactly that failure.
- **Repositories are integration-tested against a real Postgres**, not mocked.
  Name the file `*.integration.test.ts` and put it beside the adapter. It runs
  under `pnpm test:integration`, which starts the container; `pnpm test:unit`
  excludes it and must stay runnable without Docker.
- **One milestone branch per acceptance criterion.** `milestone/<name>`, branched
  from `main`. The specs land on it first, reviewed by the owner; feature
  branches then target the milestone and merge with no review; the milestone goes
  to `main` once every spec is green. Feature flags are for anything incomplete
  that reaches `main`, not for work in progress on a milestone.
- **A PR touches `e2e/` or everything else, never both.** The specs are the
  requirements, and they land before the behaviour. Changing a spec beside the
  code it judges is how a failing requirement gets made to pass, so the
  `Spec isolation` job fails it. The exception is a milestone meeting `main`,
  which carries both halves. A spec that is wrong is corrected in its own PR onto
  the milestone. See ADR-0002.
- **Review in a fresh session**, separate from the one that wrote the code,
  against the original acceptance criteria.

## Where code goes

Feature-first. A new feature named `x` looks like:

```
packages/contracts/src/x.ts
packages/core/src/x/domain/        pure functions, entities
packages/core/src/x/ports/         interfaces
packages/core/src/x/application/   use cases
packages/core/src/x/adapters/      port implementations
packages/core/src/x/index.ts       feature public surface
packages/db/src/schema.ts          tables + migration
apps/web/server/routers/x.ts       parse input -> invoke use case -> map response
apps/web/server/container.ts       wiring (composition root)
apps/web/app/(app)/x/page.tsx      composition only
apps/web/app/(app)/x/actions.ts    Server Actions: parse, invoke, revalidate
```

Add the feature to the `exports` field of `packages/core/package.json`. Do not
create directories outside this shape, and never create `lib/`, `utils/`,
`helpers/`, or `common/`.

`packages/core/src/health/` is the reference implementation. Copy its shape.
Do not delete it.

Amounts of money and entity ids already have types. Use them, do not re-invent
them:

- `Money` and `moneySchema` in `packages/contracts/src/money.ts`; every
  operation on an amount comes from `@repo/core/money` and returns a `Result`.
- `uuidV7Schema` in `packages/contracts/src/id.ts`. Each entity brands its own
  id beside its own schema. Generating an id is an effect: a use case takes a
  generator in its dependencies the way `createGetHealth` takes `now`, and
  `apps/web/server/container.ts` supplies it. A lint rule stops `uuid` being
  imported into `domain`, `application`, or `ports`.

## Before opening a PR

```bash
pnpm gates
```

If a gate fails in a way that looks wrong, the gate is probably right. Do not
weaken a rule to make a change pass without saying so explicitly in the PR.

## Things that will bite you

- Element patterns in `packages/config/eslint/boundaries.mjs` match **folders**.
  A pattern ending in `/**/*` matches nothing and silently disables that rule.
- `include` and `exclude` in an extended tsconfig resolve relative to the file
  that declares them, so they live in each package, never in the shared preset.
- TypeScript is pinned to `~6.0.x`. Raising it past 6.1 silently disables every
  type-aware lint rule, because `typescript-eslint@8` does not support it.
- `pnpm add <pkg>@latest` will fail for a release under 7 days old. That is
  `minimumReleaseAge` doing its job. Use a range, not an exact pin.
- Build-script approvals live in `allowBuilds` in `pnpm-workspace.yaml`, keyed
  `name@version`, and a new dependency with a postinstall script fails the
  install until it has an entry. `onlyBuiltDependencies` and
  `ignoredBuiltDependencies` are the pnpm 10 names for it and pnpm 11 reads
  neither. Adding an entry locally proves nothing on its own: an existing
  `node_modules` already records the answers in `.modules.yaml`, so only a cold
  install asks, and the refusal lands in CI.
