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
        'Disallow non-ASCII characters in source files. Copy belongs in a message catalogue.',
    },
    schema: [],
    messages: {
      nonAscii:
        'Non-ASCII character {{display}} (U+{{code}}) is not allowed in source. ' +
        'Source is English-only; user-facing copy belongs in a message catalogue. ' +
        'A non-English catalogue needs its exact path added to the ignores of the ' +
        'repo/english-only block in packages/config/eslint/base.mjs.',
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

/**
 * JSX text is copy when it holds a letter, in any script: the `: ` between two
 * expressions in `{name}: {state}` is layout, not language. Every other string
 * the rule checks is copy unless it is blank, so an ellipsis or a status code
 * on an attribute is text a person reads.
 */
const LETTER = /\p{L}/u;

const isBlank = (text) => text.trim() === '';

/**
 * Attributes whose string value is markup rather than something a person reads.
 *
 * The list is closed on purpose. Any other attribute given a literal is copy
 * until its name is added here, so a new prop that carries text fails lint
 * instead of passing because nobody thought to name it. `tone` is StatusDot's,
 * an enum of two signals. `aria-labelledby` holds ids, `inputMode` a keyboard
 * hint, and `pattern` a regular expression the browser validates against.
 * `method` is a form's verb: it names how a submission is sent, not anything a
 * person reads.
 */
const MARKUP_ATTRIBUTES = new Set([
  'aria-hidden',
  'aria-labelledby',
  'className',
  'dateTime',
  'href',
  'htmlFor',
  'id',
  'inputMode',
  'key',
  'lang',
  'method',
  'pattern',
  'role',
  'tone',
  'type',
]);

const isMarkupAttribute = (name) => name.startsWith('data-') || MARKUP_ATTRIBUTES.has(name);

const attributeName = (name) =>
  name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;

/** `x as T` and `x satisfies T` evaluate to `x`. */
const unwrap = (node) =>
  node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression'
    ? unwrap(node.expression)
    : node;

/**
 * The string literals an expression can evaluate to. Only the branches that
 * become the value are followed -- both arms of a ternary, both operands of a
 * logical expression -- so the `'healthy'` in `status === 'healthy' ? a : b`
 * is a test, not copy.
 */
function valueStrings(node) {
  const value = unwrap(node);
  switch (value.type) {
    case 'Literal':
      return typeof value.value === 'string' ? [{ node: value, text: value.value }] : [];
    case 'TemplateLiteral':
      return [{ node: value, text: value.quasis.map((quasi) => quasi.value.cooked ?? '').join('') }];
    case 'ConditionalExpression':
      return [...valueStrings(value.consequent), ...valueStrings(value.alternate)];
    case 'LogicalExpression':
      return [...valueStrings(value.left), ...valueStrings(value.right)];
    default:
      return [];
  }
}

/** Every string in a metadata object, at any depth. Keys are not copy. */
function metadataStrings(node) {
  const value = unwrap(node);
  switch (value.type) {
    case 'ObjectExpression':
      return value.properties.flatMap((property) =>
        property.type === 'Property' ? metadataStrings(property.value) : [],
      );
    case 'ArrayExpression':
      return value.elements.flatMap((element) => (element === null ? [] : metadataStrings(element)));
    default:
      return valueStrings(value);
  }
}

/**
 * Disallow user-facing copy written inline: JSX text, a string on an attribute
 * not listed as markup, a string a JSX expression renders, and the strings of
 * `export const metadata`. ADR-0007.
 *
 * It sees literals only. `label={health.status}` renders a domain value as UI
 * text and passes, and so does a string assigned to a variable first.
 */
const noInlineCopy = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow user-facing copy outside apps/web/messages/en.ts.',
    },
    schema: [],
    messages: {
      inlineCopy:
        'User-facing copy {{text}} is written inline. Move it to apps/web/messages/en.ts ' +
        'and import it from there.',
      inlineAttributeCopy:
        'User-facing copy {{text}} is written inline on `{{name}}`. Move it to ' +
        'apps/web/messages/en.ts and import it from there. If `{{name}}` carries no copy, ' +
        'add it to MARKUP_ATTRIBUTES in packages/config/eslint/plugin.mjs.',
    },
  },
  create(context) {
    const report = (node, text, messageId, name = '') => {
      context.report({ node, messageId, data: { text: JSON.stringify(text.trim()), name } });
    };
    const reportStrings = (found, messageId, name) => {
      for (const { node, text } of found) {
        if (!isBlank(text)) report(node, text, messageId, name);
      }
    };

    return {
      JSXText(node) {
        if (LETTER.test(node.value)) report(node, node.value, 'inlineCopy');
      },
      JSXAttribute(node) {
        const name = attributeName(node.name);
        if (node.value === null || isMarkupAttribute(name)) return;
        const value = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        reportStrings(valueStrings(value), 'inlineAttributeCopy', name);
      },
      // A child expression. An attribute's container belongs to the attribute
      // above and is not matched here.
      ':matches(JSXElement, JSXFragment) > JSXExpressionContainer'(node) {
        reportStrings(valueStrings(node.expression), 'inlineCopy');
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        if (node.id.type !== 'Identifier' || node.id.name !== 'metadata' || node.init === null) return;
        reportStrings(metadataStrings(node.init), 'inlineCopy');
      },
    };
  },
};

export const repoPlugin = {
  meta: { name: 'eslint-plugin-repo', version: '0.0.0' },
  rules: {
    'no-inline-copy': noInlineCopy,
    'no-non-ascii': noNonAscii,
  },
};

export default repoPlugin;
