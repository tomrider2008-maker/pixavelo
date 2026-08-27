import type { Declaration, Plugin, Rule } from 'postcss';

export interface SupersededCssOptions {
  /**
   * Stylesheets that intentionally replace earlier declarations with different values.
   * Entries are normalized path suffixes so the configuration stays portable in CI.
   */
  readonly authoritativeSourceSuffixes?: readonly string[];
}

const LONGHANDS: Readonly<Record<string, readonly string[]>> = {
  background: [
    'background-attachment',
    'background-clip',
    'background-color',
    'background-image',
    'background-origin',
    'background-position',
    'background-repeat',
    'background-size'
  ],
  border: [
    'border-bottom',
    'border-bottom-color',
    'border-bottom-style',
    'border-bottom-width',
    'border-color',
    'border-left',
    'border-left-color',
    'border-left-style',
    'border-left-width',
    'border-right',
    'border-right-color',
    'border-right-style',
    'border-right-width',
    'border-style',
    'border-top',
    'border-top-color',
    'border-top-style',
    'border-top-width',
    'border-width'
  ],
  'border-color': [
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color'
  ],
  'border-style': [
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style'
  ],
  'border-width': [
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width'
  ],
  'border-top': ['border-top-color', 'border-top-style', 'border-top-width'],
  'border-right': ['border-right-color', 'border-right-style', 'border-right-width'],
  'border-bottom': ['border-bottom-color', 'border-bottom-style', 'border-bottom-width'],
  'border-left': ['border-left-color', 'border-left-style', 'border-left-width'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius'
  ],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
  overflow: ['overflow-x', 'overflow-y'],
  outline: ['outline-color', 'outline-style', 'outline-width'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  font: [
    'font-family',
    'font-size',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-weight',
    'line-height'
  ],
  'grid-template': ['grid-template-areas', 'grid-template-columns', 'grid-template-rows'],
  transition: [
    'transition-delay',
    'transition-duration',
    'transition-property',
    'transition-timing-function'
  ]
};

function normalizePath(value: string) {
  return value.replaceAll('\\', '/').toLocaleLowerCase();
}

function declarationContext(rule: Rule) {
  const contexts: string[] = [];

  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'atrule') {
      const anonymousLayerIdentity =
        parent.name === 'layer' && parent.params.trim().length === 0
          ? `:${parent.source?.input.file ?? ''}:${parent.source?.start?.offset ?? ''}`
          : '';
      contexts.unshift(`@${parent.name} ${parent.params.trim()}${anonymousLayerIdentity}`);
    } else {
      contexts.unshift(`rule ${parent.selector.trim()}`);
    }
  }

  return contexts.join('|');
}

function isAuthoritative(declaration: Declaration, authoritativeSourceSuffixes: readonly string[]) {
  const file = declaration.source?.input.file;
  if (!file) return false;
  const normalizedFile = normalizePath(file);
  return authoritativeSourceSuffixes.some((suffix) => normalizedFile.endsWith(suffix));
}

function mayRemoveReplacement(
  previous: Declaration,
  next: Declaration,
  authoritativeSourceSuffixes: readonly string[]
) {
  // Identical declarations are redundant even if a browser rejects the value.
  if (previous.value.trim() === next.value.trim()) return true;

  // Different values may form a deliberate compatibility fallback. Only a
  // stylesheet explicitly audited as authoritative may replace that fallback.
  return isAuthoritative(next, authoritativeSourceSuffixes);
}

export function removeSupersededCssDeclarations(options: SupersededCssOptions = {}): Plugin {
  const authoritativeSourceSuffixes = (options.authoritativeSourceSuffixes ?? []).map(
    normalizePath
  );

  return {
    postcssPlugin: 'pixavelo-remove-superseded-css',
    OnceExit(root) {
      const latest = new Map<string, Declaration>();

      root.walkDecls((declaration) => {
        if (declaration.parent?.type !== 'rule') return;
        const rule = declaration.parent;
        const context = declarationContext(rule);
        const selector = rule.selector.trim();
        const prefix = `${context}::${selector}::`;
        const suffix = `::${declaration.important}`;
        const key = `${prefix}${declaration.prop}${suffix}`;
        const previous = latest.get(key);

        // Repeated declarations inside one rule can be deliberate browser fallbacks.
        if (
          previous?.parent &&
          previous.parent !== declaration.parent &&
          mayRemoveReplacement(previous, declaration, authoritativeSourceSuffixes)
        ) {
          previous.remove();
        }

        for (const property of LONGHANDS[declaration.prop] ?? []) {
          const superseded = latest.get(`${prefix}${property}${suffix}`);
          if (
            superseded?.parent &&
            superseded.parent !== declaration.parent &&
            isAuthoritative(declaration, authoritativeSourceSuffixes)
          ) {
            superseded.remove();
          }
        }

        latest.set(key, declaration);
      });

      root.walkRules((rule) => {
        if (rule.nodes.length === 0) rule.remove();
      });
    }
  };
}
