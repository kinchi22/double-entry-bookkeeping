/**
 * Repo-local ESLint rules.
 *
 * These exist because the corresponding project rules cannot be expressed with
 * stock rules, and a rule that is only written down in prose is not a rule.
 */

/**
 * Matches a single non-ASCII code point. The 'u' flag makes an astral character
 * one match rather than two surrogate halves.
 *
 * no-control-regex is off here because naming the control range is the entire
 * point of the rule: it defines what ASCII is.
 */
// eslint-disable-next-line no-control-regex
const NON_ASCII = /[^\x00-\x7F]/gu;

/**
 * Disallow non-ASCII characters anywhere in a source file: identifiers,
 * comments, and string literals alike.
 *
 * The project is English-only. The files it applies to, and any path exempt
 * from it, are set beside its block in `base.mjs`.
 */
const noNonAscii = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow non-ASCII characters in source files. Localized copy belongs in i18n resource files.',
    },
    schema: [],
    messages: {
      nonAscii:
        'Non-ASCII character {{display}} (U+{{code}}) is not allowed in source. ' +
        'Source is English-only; user-facing copy belongs in an i18n resource file.',
    },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();

        NON_ASCII.lastIndex = 0;
        let match = NON_ASCII.exec(text);
        while (match !== null) {
          const character = match[0];
          const codePoint = character.codePointAt(0) ?? 0;
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(match.index),
              end: sourceCode.getLocFromIndex(match.index + character.length),
            },
            messageId: 'nonAscii',
            data: {
              display: JSON.stringify(character),
              code: codePoint.toString(16).toUpperCase().padStart(4, '0'),
            },
          });
          match = NON_ASCII.exec(text);
        }
      },
    };
  },
};

export const repoPlugin = {
  meta: { name: 'eslint-plugin-repo', version: '0.0.0' },
  rules: {
    'no-non-ascii': noNonAscii,
  },
};

export default repoPlugin;
