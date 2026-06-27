export interface DeviceInfo {
  browser_name: string;
  browser_version: string;
  os_name: string;
  os_version: string;
  device_label: string;
}

function parseBrowser(ua: string): { name: string; version: string } {
  if (/Edg\//.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/);
    return { name: 'Edge', version: m?.[1] ?? '' };
  }
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return { name: 'Chrome', version: m?.[1]?.split('.')[0] ?? '' };
  }
  if (/Firefox\//.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return { name: 'Firefox', version: m?.[1]?.split('.')[0] ?? '' };
  }
  if (/Safari\//.test(ua) && /Version\//.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/);
    return { name: 'Safari', version: m?.[1]?.split('.')[0] ?? '' };
  }
  return { name: 'Browser', version: '' };
}

function parseOs(ua: string): { name: string; version: string } {
  if (/Windows NT 10/.test(ua)) return { name: 'Windows', version: '10/11' };
  if (/Windows NT 6\.3/.test(ua)) return { name: 'Windows', version: '8.1' };
  if (/Windows NT 6\.1/.test(ua)) return { name: 'Windows', version: '7' };
  if (/Mac OS X ([\d_]+)/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    return { name: 'macOS', version: m?.[1]?.replace(/_/g, '.') ?? '' };
  }
  if (/Android ([\d.]+)/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return { name: 'Android', version: m?.[1] ?? '' };
  }
  if (/iPhone OS ([\d_]+)/.test(ua) || /iPad; CPU OS ([\d_]+)/.test(ua)) {
    const m = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/);
    return { name: 'iOS', version: m?.[1]?.replace(/_/g, '.') ?? '' };
  }
  if (/Linux/.test(ua)) return { name: 'Linux', version: '' };
  return { name: 'Unknown OS', version: '' };
}

export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const browser = parseBrowser(ua);
  const os = parseOs(ua);
  const device_label = `${browser.name}${browser.version ? ` ${browser.version}` : ''} · ${os.name}${os.version ? ` ${os.version}` : ''}`;
  return {
    browser_name: browser.name,
    browser_version: browser.version,
    os_name: os.name,
    os_version: os.version,
    device_label,
  };
}
