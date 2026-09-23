# ADR-0007: Keep copy in one catalogue

**Status:** Accepted
**Date:** 2026-09-15

## Problem

The brief makes the project English-only and lets product copy be localized
later. Localization itself is decided and not built (ADR-0008). Whatever
eventually translates the app needs to find its copy, and copy written inline
can only be found string by string: only a person reading a string can tell
copy from a value.

Saying where copy lives has already failed once: `docs/GLOSSARY.md` said copy
lived in resource files while every string was inline, and no gate could see
the difference. By #10 the ESLint config exempted
four globs on the strength of that claim, three of them folder names, and #10
removed them because they also exempted any source folder with those names.

The app renders eight strings, in `apps/web/app/layout.tsx`,
`apps/web/app/(app)/page.tsx` and `apps/web/components/refresh-button.tsx`.

## Decision

Copy lives in `apps/web/messages/en.ts`: a plain `as const` object, read by
import, grouped by the part of the UI that renders it, keys and values in
English. It is not exempt from `repo/english-only`.

`repo/no-inline-copy` rejects copy written in `apps/web/app` or
`apps/web/components`:

- JSX text holding a letter, in any script;
- a string on any attribute not listed as markup in `MARKUP_ATTRIBUTES`
  (`packages/config/eslint/plugin.mjs`);
- a string a JSX expression renders: the expression itself, both arms of a
  ternary, both operands of a logical expression, through `as` and `satisfies`;
- the strings of `export const metadata`, at any depth.

Outside JSX text, a string is copy unless it is blank, whether or not it holds
a letter.

The attribute list is closed: an attribute is copy until its name is added. It
started as `aria-hidden`, `className`, `data-*`, `dateTime`, `href`, `htmlFor`,
`id`, `key`, `lang`, `role`, `tone` and `type`.

`apps/web/messages` is an `eslint-plugin-boundaries` element of its own. Nothing
else in the repo is imported by it, and only `app` and `components` import it.

## Consequences

Each rendered string is one property read, and a missing key fails to compile.
When a second locale is adopted, each import becomes a translation call and the
catalogue carries over.

The rule sees literals, not meaning:

- `label={health.status}` renders a domain enum as UI text and passes. So does a
  string assigned to a variable before it is rendered, and so does anything
  `generateMetadata` returns.
- JSX text with no letter, such as a lone dash between two expressions, passes.

The closed list costs churn in the other direction:

- Each new attribute that takes a literal and carries no copy, such as a
  `value` or a `rel`, fails lint until its name is listed.
- A symbol or number rendered as an expression, such as `{'-'}`, has to move to
  the catalogue.
- A string in `metadata` that is not copy, such as a URL, is reported and has no
  exemption. The first one needs one added.

`healthPanel.checkedAt` is a prefix rendered before an instant. A plain string
cannot express an argument, so a language that puts the instant first needs the
key rewritten.

The boundaries line is enforced by `eslint-plugin-boundaries` alone.
dependency-cruiser treats `apps/web` as one unit. Imports between files inside
`messages/` are not checked.

## Rejected alternatives

**A translation library now, with `en` alone.** A dependency, a provider around
client components and a request config, for a choice with one answer. The
version picked today need not be the one adoption picks.

**A hand-written `t()`.** A second API for the job a translation library does,
with interpolation, plurals and key typing either reinvented or left for
adoption to delete. A property read on a typed object already fails to compile
when a key is missing.

**Listing the attributes that carry copy instead.** `title`, `alt`,
`placeholder`, `aria-label`. Shorter, and it fails open: a component prop that
carries text under a name nobody listed passes. That is the dead-rule failure
this repository gates against.

**A letter test for every string.** A string with no letter would pass
everywhere, so `title="..."` or `{'404'}` would slip through, though a person
reads both. The test stays on JSX text, where the text between two expressions
is usually punctuation.
