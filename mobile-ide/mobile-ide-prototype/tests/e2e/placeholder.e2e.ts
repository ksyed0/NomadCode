/**
 * E2E tests — NomadCode IDE (Detox)
 *
 * Run with: npx detox test --configuration ios.sim.debug
 *
 * These tests require a running simulator/emulator and a Detox-configured build.
 * See https://wix.github.io/Detox/docs/introduction/getting-started for setup.
 *
 * TODO: Implement full E2E flows once Detox is configured:
 *   1. App launch → file explorer visible
 *   2. Tap a file → editor opens with content
 *   3. Type in editor → tab shows dirty indicator (●)
 *   4. Open command palette → search "save" → tap → dirty indicator clears
 *   5. Toggle terminal → terminal panel visible, accept command input
 *   6. Rotate to landscape (tablet) → sidebar + editor side-by-side
 */

describe('NomadCode IDE — E2E smoke tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('launches and shows the status bar', async () => {
    await expect(element(by.text('NomadCode'))).toBeVisible();
  });

  it('shows the file explorer on tablet layout', async () => {
    await expect(element(by.text('EXPLORER'))).toBeVisible();
  });

  it('opens the command palette via the FAB button', async () => {
    await element(by.label('Open command palette')).tap();
    await expect(element(by.text('File: Save'))).toBeVisible();
  });

  it('toggles the terminal via the FAB button', async () => {
    await element(by.label('Toggle terminal')).tap();
    await expect(element(by.text('NomadCode Terminal v0.1 (sandboxed)'))).toBeVisible();
    // Toggle off
    await element(by.label('Toggle terminal')).tap();
    await expect(element(by.text('NomadCode Terminal v0.1 (sandboxed)'))).not.toBeVisible();
  });
});
