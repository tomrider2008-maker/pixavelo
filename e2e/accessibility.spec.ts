import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

const surfaces = [
  { path: '/', heading: 'Powerful image tools. Completely private.' },
  { path: '/convert', heading: 'Convert images' },
  { path: '/optimize', heading: 'Compress images' },
  { path: '/resize', heading: 'Resize & transform' },
  { path: '/batch', heading: 'Batch Studio' },
  { path: '/edit', heading: 'Image Editor' },
  { path: '/privacy', heading: 'Metadata & Privacy' },
  { path: '/web-assets', heading: 'Web Asset Studio' },
  { path: '/developer-tools', heading: 'Professional Utilities' },
  { path: '/security', heading: 'Security design' },
  { path: '/settings', heading: 'Settings' }
] as const;

for (const surface of surfaces) {
  test(`${surface.path} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.goto(surface.path);
    await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();

    const result = await new AxeBuilder({ page })
      // This duplicate preview glyph renders user-selected color/opacity over user-selected pixels.
      // Its labeled text, color and opacity controls remain in the accessibility tree and audit.
      .exclude('.watermark-preview__text')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(
      result.violations,
      result.violations
        .map(
          (violation) =>
            `${violation.id}: ${violation.help}\n${violation.nodes
              .map((node) => `  ${node.target.join(' ')}: ${node.failureSummary ?? ''}`)
              .join('\n')}`
        )
        .join('\n\n')
    ).toEqual([]);
  });
}

test('keyboard users can skip navigation and leave the command palette', async ({
  browserName,
  page
}) => {
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  if (browserName === 'webkit') await skipLink.focus();
  else await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const commandButton = page.getByRole('button', { name: /Search tools and actions/ });
  await commandButton.focus();
  await commandButton.press('Enter');
  const searchbox = page.getByRole('searchbox', { name: 'Search tools and actions' });
  await expect(searchbox).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(commandButton).toBeFocused();
});
