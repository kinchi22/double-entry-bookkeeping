# ADR-0008: Localize without a locale in the URL

**Status:** Deferred
**Date:** 2026-09-15
**Trigger:** A locale other than `en` is scheduled for release, with a catalogue
a fluent speaker has checked.

## Problem

The brief lets product copy be localized, and requires message keys and the
default catalogue to be English. Only English ships, and ADR-0007 keeps its copy
in one catalogue.

Where the locale lives is expensive to change once pages exist, and unless it
is decided first, the first page that needs one decides it. Locale routing in
the App Router, in Next's own guide and in `next-intl`'s default alike, puts
every route under a dynamic segment such as `app/[locale]/`. Adding that segment
later moves every file under `app/` and redirects every URL. Removing it after
launch breaks every link anyone has shared.

## Decision

When the trigger holds, localization is built as follows. None of it is in
force before then.

- **Locales.** `en`, the default, and `ko`. `ja` only after a fluent speaker has
  checked its catalogue.
- **Resolution.** The first of these that names a supported locale: the
  signed-in user's setting, the `locale` cookie, `Accept-Language`, `en`. Each
  request reads only the cookie. The setting and the header decide what the
  cookie holds, when it is absent and when the setting changes.
- **No locale in the URL.** `app/` does not move. A URL names a page, not a
  language.
- **Library.** `next-intl`, without its i18n routing: a request config resolves
  the locale as above, server components call `getTranslations`, client
  components `useTranslations`. When this was decided, `next-intl` 4.14.3 listed
  `next ^16` among its peer dependencies and the repo ran Next 16.3.1. Adoption
  re-checks the version and proposes the dependency first, as `CLAUDE.md`
  requires of any new one.
- **Catalogues.** `apps/web/messages/{locale}.ts`, one per locale, with the keys
  of `en.ts`. The adopting change adds each non-English catalogue by its exact
  path to the ignores of `repo/english-only` in
  `packages/config/eslint/base.mjs`, and nothing broader.

## Consequences

Adoption turns each import of `en` into a translation call. `en.ts` carries
over, apart from the keys that need an argument (ADR-0007).

`next-intl`'s examples load a catalogue with `import()`. Dynamic imports are
forbidden everywhere (ADR-0002), so adoption imports every catalogue statically
into one map, and the server bundle carries every locale.

Without a locale in the URL:

- A crawler sends no cookie, so search engines index each page once, in whatever
  its headers resolve to. There is no per-locale URL for `hreflang` to name.
- A shared link renders in the recipient's locale, not the sender's.
- A cache keyed on the URL alone would serve one locale to everyone, so a cached
  page has to vary on the cookie. `/` is dynamic today, so nothing is cached yet.

## Rejected alternatives

**A locale segment in the URL, `app/[locale]/`.** It is `next-intl`'s default,
and it gives each locale its own URL, which is what search engines index. It
lost on reversibility. Without a segment, adding one later costs a move and
redirects. With one, once links carrying it are shared, removing it breaks
them.

**Reading the signed-in setting or `Accept-Language` on every request.** The
setting would be a database read on every render. The header varies with every
browser, so a cache that varied on it would hardly ever hit. Writing the answer
into one cookie makes both a cost paid once.

**Exempting catalogues by folder name.** `**/messages/**` and three globs like
it, as the config had until #10. They exempted any source in a folder of that
name, so a feature named `messages` would have gone unchecked.

**Catalogues nobody fluent has read.** A generated `ja` catalogue could exist
today. It could say something different from the English, and nothing here
would notice.
