import { afterEach, describe, expect, it, vi } from 'vitest';
import { showWelcomeScreen } from '../../src/ui/welcome-screen.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('welcome screen', () => {
  it('renders the restored visual onboarding with mio branding', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await showWelcomeScreen({ animate: false, waitForInput: false });

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('Welcome to mio');
    expect(output).toContain('Show the supported agents');
    expect(output).toContain('██');
  });
});
