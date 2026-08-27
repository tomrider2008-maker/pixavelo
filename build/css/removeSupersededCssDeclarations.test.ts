import postcss, { type Root } from 'postcss';
import { describe, expect, it } from 'vitest';
import { removeSupersededCssDeclarations } from './removeSupersededCssDeclarations';

interface CssSource {
  readonly css: string;
  readonly from: string;
}

async function processSources(
  sources: readonly CssSource[],
  authoritativeSourceSuffixes: readonly string[] = []
) {
  const root = postcss.root();
  for (const source of sources) {
    const parsed = postcss.parse(source.css, { from: source.from });
    root.append(parsed.nodes);
  }

  const result = await postcss([
    removeSupersededCssDeclarations({ authoritativeSourceSuffixes })
  ]).process(root, { from: undefined });
  return result.root;
}

function declarations(root: Root) {
  const values: string[] = [];
  root.walkDecls((declaration) => {
    values.push(
      `${declaration.parent?.toString().split('{')[0]?.trim()}:${declaration.prop}:${declaration.value}:${declaration.important ? 'true' : 'false'}`
    );
  });
  return values;
}

describe('removeSupersededCssDeclarations', () => {
  it('removes an identical declaration superseded in the same cascade context', async () => {
    const root = await processSources([
      { from: '/styles/base.css', css: '.tool { color: red; }' },
      { from: '/styles/theme.css', css: '.tool { color: red; }' }
    ]);

    expect(declarations(root)).toEqual(['.tool:color:red:false']);
  });

  it('allows an audited authoritative stylesheet to replace a different value', async () => {
    const root = await processSources(
      [
        { from: '/styles/base.css', css: '.tool { color: red; }' },
        { from: '/styles/phase14.css', css: '.tool { color: blue; }' }
      ],
      ['/styles/phase14.css']
    );

    expect(declarations(root)).toEqual(['.tool:color:blue:false']);
  });

  it('keeps matching declarations in different media contexts', async () => {
    const root = await processSources([
      {
        from: '/styles/base.css',
        css: '.tool { color: red; } @media (max-width: 40rem) { .tool { color: red; } }'
      }
    ]);

    expect(declarations(root)).toHaveLength(2);
  });

  it('keeps important and non-important declarations separate', async () => {
    const root = await processSources([
      { from: '/styles/base.css', css: '.tool { color: red !important; }' },
      { from: '/styles/theme.css', css: '.tool { color: red; }' }
    ]);

    expect(declarations(root)).toEqual(['.tool:color:red:true', '.tool:color:red:false']);
  });

  it('preserves repeated declarations inside one rule as browser fallbacks', async () => {
    const root = await processSources([
      { from: '/styles/base.css', css: '.tool { display: block; display: grid; }' }
    ]);

    expect(declarations(root)).toEqual(['.tool:display:block:false', '.tool:display:grid:false']);
  });

  it('preserves different cross-rule values as potential unsupported-syntax fallbacks', async () => {
    const root = await processSources([
      { from: '/styles/base.css', css: '.tool { display: block; }' },
      { from: '/styles/next.css', css: '.tool { display: future-layout; }' }
    ]);

    expect(declarations(root)).toEqual([
      '.tool:display:block:false',
      '.tool:display:future-layout:false'
    ]);
  });

  it('removes covered longhands before an authoritative shorthand', async () => {
    const root = await processSources(
      [
        {
          from: '/styles/base.css',
          css: '.tool { margin-top: 1rem; margin-right: 2rem; }'
        },
        { from: '/styles/phase14.css', css: '.tool { margin: 3rem; }' }
      ],
      ['/styles/phase14.css']
    );

    expect(declarations(root)).toEqual(['.tool:margin:3rem:false']);
  });

  it('keeps longhands before a non-authoritative shorthand and keeps a shorthand before a longhand', async () => {
    const root = await processSources([
      { from: '/styles/base.css', css: '.tool { margin-top: 1rem; }' },
      { from: '/styles/theme.css', css: '.tool { margin: 2rem; }' },
      { from: '/styles/final.css', css: '.tool { margin-left: 3rem; }' }
    ]);

    expect(declarations(root)).toEqual([
      '.tool:margin-top:1rem:false',
      '.tool:margin:2rem:false',
      '.tool:margin-left:3rem:false'
    ]);
  });
});
