import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './sanitizeSvg';

describe('sanitizeSvg', () => {
  it('accepts a static self-contained SVG and reads its dimensions', () => {
    const result = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><rect width="24" height="16" fill="#1746ed"/></svg>'
    );
    expect(result.text).toContain('<rect');
    expect(result.dimensions).toMatchObject({ width: 24, height: 16, pixels: 384 });
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="opacity"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>'
  ])('rejects active, external, or foreign content', (source) => {
    expect(() => sanitizeSvg(source)).toThrow(expect.objectContaining({ code: 'UNSAFE_SVG' }));
  });

  it('allows internal fragment references', () => {
    const result = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><defs><path id="p" d="M0 0h1"/></defs><use href="#p"/></svg>'
    );
    expect(result.text).toContain('href="#p"');
    expect(result.dimensions).toMatchObject({ width: 20, height: 10 });
  });
});
