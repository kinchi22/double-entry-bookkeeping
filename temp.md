# Project Bootstrap Brief

> This document is a work order for an AI agent (Claude Code / Cowork). **Do not write any product feature code until Phase 0 is complete.**

---

## 0. Fill this in first (human)

```
Product name: Double Entry Bookkeeping
One-line description: Full-stack web app for double-entry bookkeeping.
First vertical slice (one feature): Create record with the amount(JPY) -> list records.
```

If these fields are empty, the agent must stop and ask the user rather than start work.

---

## 1. Design principle

**Verifiability is the architecture.** Documentation and conventions do not constrain AI output — failing tests and CI gates do. Therefore:

- Every rule must be enforced by CI with a non-zero exit, not stated in prose
- Once a rule exists, **write a deliberate violation and confirm the gate actually fails**
- Requirements are expressed as **executable acceptance criteria (Given/When/Then)**, never as prose specs
- Human review budget is reserved for: schema changes, auth/permission logic, money, data migrations, and the DI composition root. Everything else is AI line-level review plus gates

**Start small, but draw the boundaries on day one.** Minimum physical package separation, maximum gate density.

---

## 2. Language convention

The entire project is English-only. This applies to:

- Source code: identifiers, types, comments, string literals in code
- Commit messages, branch names, PR titles and descriptions
- All documentation: README, ADRs, glossary, [`CLAUDE.md`](http://CLAUDE.md) files
- Test names and acceptance criteria
- Database identifiers: table names, column names, enum values
- Error messages and log output

**Enforcement:** add a lint rule rejecting non-ASCII characters in source files under `packages/**` and `apps/web/{server,app}/**`. Exempt user-facing copy, which must live in i18n resource files rather than inline — this keeps the rule strict without blocking localization later.

Product UI copy may be localized through i18n, but the message *keys* and the default locale bundle are English.

---

## 3. Stack


| Area                     | Choice                                                         |
| ------------------------ | -------------------------------------------------------------- |
| Framework                | Next.js (App Router)                                           |
| Language                 | TypeScript (strict, `any` forbidden)                           |
| Monorepo                 | pnpm workspace + Turborepo                                     |
| API contract             | tRPC + zod                                                     |
| ORM                      | Drizzle                                                        |
| Database                 | Postgres (Neon or similar — portable; no vendor-specific APIs) |
| Hosting                  | Vercel, with a planned AWS migration path                      |
| Unit / integration tests | Vitest                                                         |
| E2E                      | Playwright                                                     |
| Mutation testing         | Stryker (domain layer only)                                    |
| Boundary enforcement     | eslint-plugin-boundaries + dependency-cruiser                  |
| Duplication check        | jscpd                                                          |


---

## 4. Directory layout (stage 1)

```
repo/
├─ apps/
│  └─ web/                        # Next.js — composition only. No logic.
│     ├─ app/
│     │  ├─ (app)/                # pages
│     │  └─ api/trpc/[trpc]/route.ts
│     ├─ server/
│     │  ├─ routers/              # tRPC routers (thin)
│     │  └─ container.ts          # DI composition root ★ human-reviewed
│     └─ components/              # app-local only
├─ packages/
│  ├─ contracts/                  # zod schemas + types. Zero dependencies.
│  ├─ core/                       # domain + use cases + ports + adapters
│  │  └─ src/<feature>/
│  │     ├─ domain/               # pure functions, entities
│  │     ├─ application/          # use cases
│  │     ├─ ports/                # interfaces
│  │     └─ adapters/             # port implementations (promoted to infra later)
│  ├─ db/                         # Drizzle schema + migrations
│  ├─ ui/                         # design system (domain-agnostic)
│  └─ config/                     # eslint / ts / tailwind / dep-cruiser presets
└─ .github/workflows/

```

**Do not create:** top-level directories not listed above, empty directories, or catch-all folders such as `lib/`, `utils/`, `helpers/`, `common/`.

**Do not create** `packages/infra` **yet.** Adapters live in `core/src/<feature>/adapters/`, isolated from domain and application layers by path-based lint rules. Promote to a package once there are two or more external integrations.

### Route handler rule

tRPC procedures and Server Actions do exactly three things: **parse input → invoke use case → map response.** Anything longer is itself a design violation; move the logic into `core`.

---

## 5. Allowed dependency matrix

This table *is* the `eslint-plugin-boundaries` configuration. **Whitelist mode (deny by default)** — anything not in the table is a violation.


| from → to         | contracts | core | db  | ui  | apps/web |
| ----------------- | :---------: | :----: | :---: | :---: | :--------: |
| **contracts**     | –         | ✕    | ✕   | ✕   | ✕        |
| **core**          | ✓         | ✓    | ✕   | ✕   | ✕        |
| **core/adapters** | ✓         | ✓    | ✓   | ✕   | ✕        |
| **ui**            | ✕         | ✕    | ✕   | ✓   | ✕        |
| **apps/web**      | ✓         | ✓    | ✕   | ✓   | ✓        |


### Internal layer rules in `core` (path-based)

- `core/src/*/domain/**` — must not import `application`, `ports`, or `adapters`
- `core/src/*/application/**` — must not import `adapters` (use `ports` only)
- `core/src/*/{domain,application}/**` — must not import `drizzle-orm`, `next`, `react`, `fetch`, or `process.env`

### Package-level isolation

`packages/core/package.json` must not list `next` or `react` as dependencies. Remove the ability to break the rule rather than policing it.

---

## 6. CI gates

Run in order. Any failure blocks merge.

1. `typecheck` — TS strict
2. `lint` — ESLint + boundaries + no-restricted-imports + non-ASCII rule
3. `dep-cruise` — dependency-cruiser (cycles, orphans, layer violations)
4. `test:unit` — Vitest
5. `test:mutation` — Stryker, scoped to `core/src/*/domain/**`, with a threshold
6. `build`
7. `test:e2e` — Playwright against the Vercel preview deployment
8. `jscpd` — duplication threshold

### dependency-cruiser configuration

- `tsPreCompilationDeps: true` — type-only imports are also checked. `core` knowing an adapter's types is still a design leak, even with no runtime dependency
- Exempt `contracts`, where type sharing is intended
- Non-zero exit on violation
- Emit the SVG graph as a CI artifact

### Dynamic imports

Selecting a runtime implementation via `import()` is forbidden outside `apps/web/server/container.ts`. This shrinks the region static analysis cannot see to a single file, which a human reviews.

### Barrel files

- Exactly one `index.ts` per package, at the public surface
- **No barrels inside a package** — they launder layer violations and create cycles
- Block deep imports with the `exports` field:

```json
"exports": {
  ".": "./src/index.ts",
  "./<feature>": "./src/<feature>/index.ts"
}

```

### RSC boundary

Add `import 'server-only'` to the server-side entry points of `packages/core`, so a client component importing domain or adapter code breaks the build.

---

## 7. Fixed decisions

The agent must not change these unilaterally. If a change seems necessary, stop and ask.


| Item                 | Decision                                                                                         | Enforcement                     |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------- |
| Glossary             | One canonical name per concept in `docs/[GLOSSARY.md](http://GLOSSARY.md)`. No synonyms.         | review                          |
| Error model          | Domain returns `Result<T, DomainError>`; no throwing. HTTP mapping happens only in tRPC routers. | lint: no `throw` in `domain/**` |
| IDs                  | uuid v7 with branded types (`OrderId`, etc.)                                                     | type system                     |
| Money                | Integer minor units with a branded `Money` type. No raw `number` arithmetic.                     | type system                     |
| Dates                | Store UTC, convert only at display. `timestamptz` in the database.                               | review                          |
| Transaction boundary | **Owned by the use case.** Repositories never begin a transaction.                               | review                          |
| Authorization        | Checked at the **use case entry point.** Controllers only pass the auth context.                 | review                          |
| Structure            | Feature-first (layers inside features, not features inside layers)                               | directory rules                 |
| Branching            | Trunk-based with feature flags. One task = one small PR.                                         | —                               |


---

## 8. Sequence

### Phase 0 — Pipeline skeleton (before any feature code)

Goal: **an empty feature travels the full path — spec → tests → preview → staging.**

1. Initialize pnpm workspace + Turborepo, create the layout in §4
2. Write eslint / ts / tailwind / dep-cruiser presets in `packages/config` (**as a workspace package**, so it can be published to npm later)
3. Implement the dependency matrix as boundaries configuration
4. Configure `exports`, `server-only`, `no-restricted-imports`, and the non-ASCII rule
5. Wire every gate from §6 into GitHub Actions
6. Connect Vercel: PR → preview deployment, merge to main → staging deployment
7. **Verify the gates are alive** (§9). Do not proceed to Phase 1 until this passes.

### Phase 1 — Reference vertical slice

Take the single feature named in §0 and drive it through the entire path:

```
contracts/<feature>.ts
  → core/src/<feature>/domain/
  → core/src/<feature>/ports/
  → core/src/<feature>/application/
  → core/src/<feature>/adapters/
  → db/schema/
  → apps/web/server/routers/<feature>.ts
  → apps/web/server/container.ts
  → apps/web/app/(app)/<feature>/page.tsx
  → unit + integration + E2E tests

```

**Keep this slice permanently — do not delete it.** It is the reference implementation every later feature imitates, and the source material if this repo is later extracted into a template.

### Phase 2 — Scaffolding generator

Implement `pnpm gen:feature <name>` with `turbo gen` or plop, so the agent never *decides* file placement, naming, or boilerplate. No room for judgment means no drift.

### Phase 3 — Feature work

From here, every task should start with a single line:

> "Add `<new feature>` following the same structure as `<reference feature>`."

---

## 9. Gate liveness verification (Phase 0 exit criteria)

**Writing a rule and having a working rule are different things.** In monorepos, path alias resolution frequently breaks silently, leaving rules dead.

Create deliberate violations under `fixtures/violations/` and write a test that asserts each one actually fails.


| Violation fixture                                    | Gate that must fail   |
| ---------------------------------------------------- | --------------------- |
| `core/domain` imports `adapters`                     | boundaries            |
| `core/domain` imports `drizzle-orm`                  | no-restricted-imports |
| `core` imports `apps/web`                            | boundaries            |
| Deep import into a package (`@repo/core/src/...`)    | typecheck (exports)   |
| Two files forming a cycle                            | dependency-cruiser    |
| Client component imports a `core` server entry point | build (server-only)   |
| `throw` in `domain/**`                               | lint rule             |
| Non-ASCII identifier or comment in `packages/**`     | lint rule             |
| A test that only asserts on mocks                    | Stryker threshold     |


Keep this check in CI permanently, so a rule breaking later surfaces immediately.

---

## 10. Working agreement for the agent

- **If unsure, ask — do not invent.** Any design decision not covered in §7 requires stopping and asking
- **No new npm dependencies** without proposing them first, with a reason
- **Search existing code before writing new code.** Duplicate reimplementation is the most common failure mode
- **Introduce an interface only when there are two or more implementations.** No speculative abstraction
- **Tests assert behavior, not mocks.** Repositories are integration-tested against a real Postgres (testcontainers or local)
- **Keep PRs small.** One PR maps to one acceptance criterion
- **Review in a fresh session**, separate from the one that wrote the code, checking against the original acceptance criteria

---

## 11. Vercel → AWS migration readiness

Three things to hold to now:

1. **Domain logic stays runtime-agnostic and pure**, route handlers stay thin — migration then replaces only `apps/`
2. **Portable Postgres**, no vendor-specific APIs
3. **Do not build background work on top of serverless function timeouts.** The painful part of migration is not rendering — it is queues, cron, and long-running jobs. Separate them into a distinct worker entry point from the start, so only the trigger mechanism changes

---

## 12. What this approach does not cover

Passing gates does not mean the product is right. These remain human responsibilities:

- UX quality
- Performance under real load
- Security at the level of "did we consider that threat at all"
- Product judgment and prioritization

Remove the human here and you get something cleanly built and wrong.