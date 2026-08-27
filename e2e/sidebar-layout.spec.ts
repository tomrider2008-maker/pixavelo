import { expect, test, type Locator, type Page } from '@playwright/test';

const desktopViewports = [
  { width: 1366, height: 600 },
  { width: 861, height: 600 }
] as const;

const mobileViewports = [
  { width: 390, height: 600 },
  { width: 844, height: 390 }
] as const;

test('short desktop viewports keep utility navigation above the status bar', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile-'), 'Desktop sidebar geometry probe.');

  for (const viewport of desktopViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const sidebar = page.getByRole('complementary', { name: 'Primary navigation' });
    const primary = sidebar.locator('.sidebar__primary');
    const utility = sidebar.getByRole('navigation', { name: 'Support and settings' });
    const settings = utility.getByRole('link', { name: 'Settings', exact: true });
    const help = utility.getByRole('link', { name: 'Help', exact: true });
    const status = page.getByRole('contentinfo', { name: 'Application status' });
    const dashboard = primary.getByRole('link', { name: 'Dashboard', exact: true });
    const developerTools = primary.getByRole('link', {
      name: 'Developer Tools',
      exact: true
    });

    await expect(sidebar).toBeVisible();
    await expect(status).toBeVisible();
    await expect(primary.getByRole('link')).toHaveCount(9);
    await expect(settings).toBeVisible();
    await expect(help).toBeVisible();
    await expectDesktopContainment({ sidebar, utility, settings, help, status });

    await dashboard.focus();
    await expect(dashboard).toBeFocused();
    expectInside(await box(dashboard), await box(primary));

    await developerTools.focus();
    await expect(developerTools).toBeFocused();
    expectInside(await box(developerTools), await box(primary));
    expectInside(await box(developerTools), await box(sidebar));
    await expectDesktopContainment({ sidebar, utility, settings, help, status });

    await developerTools.click();
    await expect(page).toHaveURL(/\/developer-tools$/);
  }
});

test('short mobile drawers keep primary and utility routes reachable', async ({
  page
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile drawer geometry probe.');

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
    const status = page.getByRole('contentinfo', { name: 'Application status' });
    await expect(status).toBeHidden();

    const sidebar = page.getByRole('complementary', { name: 'Primary navigation' });
    const primary = sidebar.locator('.sidebar__primary');
    const utility = sidebar.getByRole('navigation', { name: 'Support and settings' });
    const settings = utility.getByRole('link', { name: 'Settings', exact: true });
    const help = utility.getByRole('link', { name: 'Help', exact: true });
    const developerTools = primary.getByRole('link', {
      name: 'Developer Tools',
      exact: true
    });

    await openMobileSidebar(mobileNavigation, sidebar);
    await expect(sidebar).toBeVisible();
    expectInside(await box(sidebar), await viewportBox(page));
    expectInside(await box(utility), await box(sidebar));
    expectInside(await box(settings), await box(sidebar));
    expectInside(await box(help), await box(sidebar));

    await developerTools.focus();
    await expect(developerTools).toBeFocused();
    expectInside(await box(developerTools), await box(primary));
    expectInside(await box(developerTools), await box(sidebar));
    expectInside(await box(settings), await box(sidebar));
    expectInside(await box(help), await box(sidebar));

    await developerTools.click();
    await expect(page).toHaveURL(/\/developer-tools$/);

    await openMobileSidebar(mobileNavigation, sidebar);
    await sidebar
      .getByRole('navigation', { name: 'Support and settings' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await expect(page).toHaveURL(/\/settings$/);

    await openMobileSidebar(mobileNavigation, sidebar);
    await sidebar
      .getByRole('navigation', { name: 'Support and settings' })
      .getByRole('link', { name: 'Help', exact: true })
      .click();
    await expect(page).toHaveURL(/\/help$/);
  }
});

async function openMobileSidebar(mobileNavigation: Locator, sidebar: Locator) {
  await mobileNavigation.getByRole('button', { name: 'More', exact: true }).click();
  await expect.poll(async () => (await box(sidebar)).x).toBeGreaterThanOrEqual(-1);
}

async function expectDesktopContainment({
  sidebar,
  utility,
  settings,
  help,
  status
}: {
  readonly sidebar: Locator;
  readonly utility: Locator;
  readonly settings: Locator;
  readonly help: Locator;
  readonly status: Locator;
}) {
  const sidebarBox = await box(sidebar);
  const statusBox = await box(status);
  const utilityBox = await box(utility);
  const settingsBox = await box(settings);
  const helpBox = await box(help);

  expect(sidebarBox.y + sidebarBox.height).toBeLessThanOrEqual(statusBox.y + 1);
  expectInside(utilityBox, sidebarBox);
  expectInside(settingsBox, sidebarBox);
  expectInside(helpBox, sidebarBox);
  expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(statusBox.y + 1);
  expect(helpBox.y + helpBox.height).toBeLessThanOrEqual(statusBox.y + 1);
}

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error(`Element has no layout box: ${locator.toString()}`);
  return result;
}

async function viewportBox(page: Page) {
  return page.evaluate(() => ({
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight
  }));
}

function expectInside(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
  tolerance = 1
) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + tolerance);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + tolerance);
}
