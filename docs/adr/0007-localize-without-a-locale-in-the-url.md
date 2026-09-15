# ADR-0007: Localize without a locale in the URL

**Status:** Deferred
**Date:** 2026-09-15
**Trigger:** A locale other than `en` is scheduled for release, with a catalogue
a fluent speaker has checked.

## Problem

The brief lets product copy be localized, and requires message keys and the
default catalogue to be English. Only English ships. The app renders eight
strings.

Two parts of localization are expensive to change once pages exist, and unless
they are decided first, the first page that needs one decides it:

- **Where the locale lives.** Locale routing in the App Router, in Next's own
  guide and in `next-intl`'s default alike, puts every route under a dynamic
  segment such as `app/[locale]/`. Adding that segment later moves every file
  under `app/` and redirects every URL. Removing it after launch breaks every link anyone has
  shared.
- **Where copy lives.** Copy written inline has to be found string by string
  before any of it can be translated, and only a person reading a string can
  tell copy from a value.

This decision has already failed once, by being written down as a rule and not
built. ADR-0001 records it: `docs/GLOSSARY.md` said copy lived in resource
files while every string was inline, and the ESLint config exempted four folder
names that nothing used. #10 removed the exemptions. They matched by name, so
they also exempted any source folder called `messages`, `i18n` or `locales`.

## Decision

When the trigger holds, localization is built as follows. Until then, none of
this section is in force.

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

A decision that is not built still needs copy to have a home now, or the second
locale starts with a search through JSX. The part that costs nothing is
therefore already in force, and `docs/ARCHITECTURE.md` states it under "User-facing
copy":

- Copy lives in `apps/web/messages/en.ts`: a plain object, read by import, one
  namespace per component that renders copy. That is the shape `next-intl`
  reads, so adoption turns each import into a translation call and the
  catalogue carries over.
- `repo/no-inline-copy` rejects copy written in `apps/web/app` or
  `apps/web/components`: JSX text, a string on any attribute not listed as
  markup, a string a JSX expression renders, and the strings of
  `export const metadata`.
- `apps/web/messages` is its own boundaries element. It imports nothing, and
  only `app` and `components` import it.

The rule sees literals, not meaning:

- `label={health.status}` renders a domain enum as UI text and passes. So does
  a string assigned to a variable before it is rendered, and so does anything
  `generateMetadata` returns.
- A string in `metadata` that is not copy, such as a URL, is reported, and
  there is no exemption for it. The first one needs one added.
- The attribute list is closed. Each new attribute that takes a literal and
  carries no copy, a `value` or a `rel`, fails lint until its name is listed.

`healthPanel.checkedAt` is a prefix rendered before an instant. A language that
puts the instant first needs one message with an argument, which a plain string
cannot hold, so adoption rewrites that key.

`next-intl`'s examples load a catalogue with `import()`. Dynamic imports are
forbidden everywhere (ADR-0002), so adoption imports every catalogue statically
into one map, and the server bundle carries every locale.

Without a locale in the URL:

- A crawler sends no cookie, so search engines index each page once, in
  whatever its headers resolve to. There is no per-locale URL for `hreflang` to
  name.
- A shared link renders in the recipient's locale, not the sender's.
- A cache keyed on the URL alone would serve one locale to everyone. A cached
  page has to vary on the cookie. `/` is dynamic today, so nothing is cached yet.

## Rejected alternatives

**A locale segment in the URL, `app/[locale]/`.** It is `next-intl`'s default
and gives each locale a URL of its own, which is what search engines index. It
lost on reversibility. Without a segment, adding one later costs a move and
redirects. With one, once links carrying it are shared, removing it breaks
them.

**Building `next-intl` now, with `en` alone.** A dependency, a provider around
client components and a request config, for a choice with one answer. The
version chosen today need not be the one adoption chooses. The catalogue and the
lint rule give adoption what it needs without any of it.

**A hand-written `t()` now.** A second API for the job `next-intl` does, with
interpolation, plurals and key typing either reinvented or left for adoption to
delete. A property read on a typed object already fails to compile when the key
is missing.

**Reading the signed-in setting or `Accept-Language` on every request.** The
setting is a database read on every render. The header has as many values as
there are browsers, so a cache that varied on it would hardly ever hit.
Writing the answer into one cookie makes both a cost paid once.

**Exempting catalogues by folder name.** `**/messages/**` and three globs like
it, as the config had until #10. They exempted any source in a folder of that
name, so a feature named `messages` would have gone unchecked.

**Listing the attributes that carry copy instead.** `title`, `alt`,
`placeholder`, `aria-label`. Shorter, and it fails open: a component prop that
carries text under a name nobody listed passes, which is the dead-rule failure
this repository gates against.

**Catalogues nobody fluent has read.** A generated `ja` catalogue could exist
today. It can say something other than the English, and nothing here would
notice.
