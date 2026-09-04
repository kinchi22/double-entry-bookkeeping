# Glossary

One canonical name per concept. No synonyms. If a new concept needs a name, add
it here in the same commit that introduces it.

| Term             | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| Adapter          | A concrete implementation of a Port. The only place infrastructure appears.  |
| Branded type     | A primitive carrying a compile-time name, so two `number`s stop being interchangeable. Erased at runtime. |
| Component        | A checked dependency of the system, as reported by the health slice.         |
| Composition root | `apps/web/server/container.ts`. The only place implementations are chosen.   |
| Contract         | A zod schema plus its inferred type, in `packages/contracts`.                |
| Domain error     | A failure value carrying a stable `DomainErrorCode`. Never an exception.     |
| Minor units      | The integer smallest denomination of a currency. JPY has no minor unit split.|
| Money            | A branded integer count of minor units. Built and combined only through `@repo/core/money`. |
| Port             | An interface stated in domain terms that the application layer depends on.   |
| Public surface   | The entry points a package lists in its `exports` field.                     |
| Shared kernel    | Vocabulary several features depend on, held in `core/src/<name>/domain` with no ports or adapters. `money` is the only one. |
| Result           | `Ok<T>` or `Err<E>`. The return type of any domain operation that can fail. |
| Server Action    | The app's write path. Parses input, invokes a use case through `createCaller`, invalidates what it made stale. |
| Use case         | One application operation. Owns orchestration and the transaction boundary.  |

## Naming rules

- Source is English-only, enforced by the `repo/no-non-ascii` lint rule.
- User-facing copy lives in i18n resource files, never inline. Message keys and
  the default locale bundle are English.
