import { describe, it, expect } from 'vitest';
import { collectBrowserEnvironment } from '../../js/shared/browserEnvironment.js';

const UA_CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_FIREFOX_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';
const UA_SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15';
const UA_EDGE_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36';

function makeNav(userAgent, extra = {}) {
  return { userAgent, language: 'en-US', ...extra };
}

describe('collectBrowserEnvironment', () => {
  describe('browser detection', () => {
    it('detects Chrome from UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_CHROME_WIN));
      expect(result.browser).toBe('Chrome');
      expect(result.browserVersion).toBe('124.0.0.0');
    });

    it('detects Firefox from UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_FIREFOX_WIN));
      expect(result.browser).toBe('Firefox');
      expect(result.browserVersion).toBe('126.0');
    });

    it('detects Safari from UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_SAFARI_MAC));
      expect(result.browser).toBe('Safari');
      expect(result.browserVersion).toBe('17.4.1');
    });

    it('detects Edge (not Chrome) when Edg/ token present', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_EDGE_WIN));
      expect(result.browser).toBe('Edge');
      expect(result.browserVersion).toBe('124.0.0.0');
    });

    it('returns Unknown for unrecognised UA', async () => {
      const result = await collectBrowserEnvironment('', makeNav('SomeFutureBot/1.0'));
      expect(result.browser).toBe('Unknown');
      expect(result.browserVersion).toBe('');
    });
  });

  describe('OS detection', () => {
    it('detects Windows from UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_CHROME_WIN));
      expect(result.os).toBe('Windows');
      expect(result.osVersion).toBe('10.0');
    });

    it('detects macOS from UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_SAFARI_MAC));
      expect(result.os).toBe('macOS');
      expect(result.osVersion).toBe('14_4_1');
    });

    it('detects Android and extracts device model from UA', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_CHROME_ANDROID));
      expect(result.os).toBe('Android');
      expect(result.osVersion).toBe('14');
      expect(result.model).toBe('Pixel 7');
    });

    it('uses userAgentData.platform when available (synchronous low-entropy)', async () => {
      const nav = makeNav(UA_CHROME_WIN, {
        userAgentData: { platform: 'Windows' },
      });
      const result = await collectBrowserEnvironment('', nav);
      expect(result.os).toBe('Windows');
    });
  });

  describe('high-entropy values (Chromium async API)', () => {
    it('uses model and platformVersion from getHighEntropyValues when available', async () => {
      const nav = makeNav(UA_CHROME_ANDROID, {
        userAgentData: {
          platform: 'Android',
          getHighEntropyValues: async () => ({
            model: 'Pixel 7',
            platformVersion: '14.0.0',
          }),
        },
      });
      const result = await collectBrowserEnvironment('', nav);
      expect(result.model).toBe('Pixel 7');
      expect(result.osVersion).toBe('14.0.0');
    });

    it('falls back to UA parsing when getHighEntropyValues throws', async () => {
      const nav = makeNav(UA_CHROME_ANDROID, {
        userAgentData: {
          platform: 'Android',
          getHighEntropyValues: async () => { throw new Error('not allowed'); },
        },
      });
      const result = await collectBrowserEnvironment('', nav);
      expect(result.os).toBe('Android');
      expect(result.model).toBe('Pixel 7'); // from UA fallback
    });

    it('does not crash when userAgentData is absent', async () => {
      const nav = makeNav(UA_FIREFOX_WIN);
      await expect(collectBrowserEnvironment('', nav)).resolves.not.toThrow();
    });
  });

  describe('passthrough fields', () => {
    it('passes recorderMimeType through unchanged', async () => {
      const result = await collectBrowserEnvironment('audio/webm;codecs=opus', makeNav(UA_CHROME_WIN));
      expect(result.recorderMimeType).toBe('audio/webm;codecs=opus');
    });

    it('reads language from navigator', async () => {
      const nav = makeNav(UA_CHROME_WIN, { language: 'de-DE' });
      const result = await collectBrowserEnvironment('', nav);
      expect(result.language).toBe('de-DE');
    });

    it('includes raw userAgent string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(UA_CHROME_WIN));
      expect(result.userAgent).toBe(UA_CHROME_WIN);
    });
  });

  describe('edge cases', () => {
    it('returns safe fallback object for empty UA string', async () => {
      const result = await collectBrowserEnvironment('', makeNav(''));
      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
      expect(result.browserVersion).toBe('');
      expect(result.osVersion).toBe('');
      expect(result.model).toBe('');
    });

    it('does not crash when nav is null', async () => {
      await expect(collectBrowserEnvironment('', null)).resolves.toBeDefined();
    });

    it('does not crash when nav is undefined', async () => {
      await expect(collectBrowserEnvironment('', undefined)).resolves.toBeDefined();
    });
  });
});
