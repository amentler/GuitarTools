/**
 * Collects browser/OS/device metadata for diagnostic sidecar logging.
 * Async because getHighEntropyValues() (Chromium-only) provides model + precise platform version.
 * Falls back to UA string parsing on all other browsers.
 */

function parseBrowser(ua) {
  if (/Edg\//.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/);
    return { browser: 'Edge', browserVersion: m ? m[1] : '' };
  }
  if (/Firefox\/([\d.]+)/.test(ua)) {
    return { browser: 'Firefox', browserVersion: RegExp.$1 };
  }
  if (/Chrome\/([\d.]+)/.test(ua)) {
    return { browser: 'Chrome', browserVersion: RegExp.$1 };
  }
  // Safari: has Version/ token and no Chrome/
  if (/Version\/([\d.]+).*Safari\//.test(ua)) {
    return { browser: 'Safari', browserVersion: RegExp.$1 };
  }
  return { browser: 'Unknown', browserVersion: '' };
}

function parseOS(ua, platform) {
  // Use userAgentData.platform (low-entropy, synchronous) when available
  if (platform) {
    const p = platform.toLowerCase();
    if (p.includes('win'))     return { os: 'Windows',  osVersion: parseWindowsVersion(ua) };
    if (p.includes('mac'))     return { os: 'macOS',    osVersion: parseMacVersion(ua) };
    if (p.includes('android')) return { os: 'Android',  osVersion: parseAndroidVersion(ua), model: parseAndroidModel(ua) };
    if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) {
      return { os: 'iOS', osVersion: parseIOSVersion(ua), model: '' };
    }
    if (p.includes('linux'))   return { os: 'Linux',    osVersion: '', model: '' };
  }

  // UA string fallback
  if (/Windows NT ([\d.]+)/.test(ua)) {
    return { os: 'Windows', osVersion: RegExp.$1, model: '' };
  }
  if (/Macintosh; Intel Mac OS X ([^\s)]+)/.test(ua)) {
    return { os: 'macOS', osVersion: RegExp.$1, model: '' };
  }
  if (/iPhone|iPad/.test(ua)) {
    return { os: 'iOS', osVersion: parseIOSVersion(ua), model: '' };
  }
  if (/Android ([^;]+); ([^)]+)/.test(ua)) {
    return { os: 'Android', osVersion: RegExp.$1.trim(), model: RegExp.$2.trim() };
  }
  if (/Linux/.test(ua)) {
    return { os: 'Linux', osVersion: '', model: '' };
  }
  return { os: 'Unknown', osVersion: '', model: '' };
}

function parseWindowsVersion(ua) {
  const m = ua.match(/Windows NT ([\d.]+)/);
  return m ? m[1] : '';
}

function parseMacVersion(ua) {
  const m = ua.match(/Mac OS X ([^\s);]+)/);
  return m ? m[1] : '';
}

function parseAndroidVersion(ua) {
  const m = ua.match(/Android ([^;)]+)/);
  return m ? m[1].trim() : '';
}

function parseAndroidModel(ua) {
  const m = ua.match(/Android [^;]+; ([^)]+)\)/);
  return m ? m[1].trim() : '';
}

function parseIOSVersion(ua) {
  const m = ua.match(/OS ([\d_]+) like Mac OS X/);
  return m ? m[1] : '';
}

/**
 * @param {string} [recorderMimeType='']
 * @param {Navigator|null|undefined} [nav=globalThis.navigator]
 * @returns {Promise<{
 *   userAgent: string,
 *   browser: string,
 *   browserVersion: string,
 *   os: string,
 *   osVersion: string,
 *   model: string,
 *   language: string,
 *   recorderMimeType: string
 * }>}
 */
export async function collectBrowserEnvironment(recorderMimeType = '', nav = globalThis.navigator) {
  const ua = nav?.userAgent ?? '';
  const platform = nav?.userAgentData?.platform ?? '';

  const { browser, browserVersion } = parseBrowser(ua);
  const osInfo = parseOS(ua, platform);

  const result = {
    userAgent: ua,
    browser,
    browserVersion,
    os: osInfo.os,
    osVersion: osInfo.osVersion,
    model: osInfo.model ?? '',
    language: nav?.language ?? '',
    recorderMimeType,
  };

  if (nav?.userAgentData?.getHighEntropyValues) {
    try {
      const high = await nav.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
      if (high.model)           result.model     = high.model;
      if (high.platformVersion) result.osVersion = high.platformVersion;
    } catch {
      // keep UA-parsed fallback values
    }
  }

  return result;
}
