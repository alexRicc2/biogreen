export type PlatformId = 'windows' | 'macos-arm' | 'macos-intel' | 'linux' | 'unknown';

export const DOWNLOADABLE_PLATFORMS: PlatformId[] = [
  'windows',
  'macos-arm',
  'macos-intel',
];

export function platformLabel(id: PlatformId): string {
  switch (id) {
    case 'windows':
      return 'Windows';
    case 'macos-arm':
      return 'macOS (Apple Silicon)';
    case 'macos-intel':
      return 'macOS (Intel)';
    case 'linux':
      return 'Linux';
    default:
      return 'Unknown';
  }
}

export function platformShortLabel(id: PlatformId): string {
  switch (id) {
    case 'windows':
      return 'Windows (.exe)';
    case 'macos-arm':
      return 'macOS Apple Silicon (.dmg)';
    case 'macos-intel':
      return 'macOS Intel (.dmg)';
    default:
      return platformLabel(id);
  }
}

/** Best-effort OS / arch detection for recommending a desktop build. */
export function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent;
  const platform = navigator.platform ?? '';

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows';
  }

  if (/Linux/i.test(platform) && !/Android/i.test(ua)) {
    return 'linux';
  }

  const isMac =
    /Mac/i.test(platform) ||
    /Macintosh/i.test(ua) ||
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform === 'macOS';

  if (isMac) {
    return detectMacArch();
  }

  return 'unknown';
}

function detectMacArch(): 'macos-arm' | 'macos-intel' {
  // Chromium: User-Agent Client Hints (sync platform is enough when available).
  const uad = (navigator as Navigator & {
    userAgentData?: { platform?: string; architecture?: string };
  }).userAgentData;

  if (uad?.architecture) {
    return /arm/i.test(uad.architecture) ? 'macos-arm' : 'macos-intel';
  }

  // WebGL renderer heuristic (works in Safari / Firefox on Apple Silicon).
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getExtension' in gl) {
      const info = (gl as WebGLRenderingContext).getExtension(
        'WEBGL_debug_renderer_info',
      );
      if (info) {
        const renderer = (gl as WebGLRenderingContext).getParameter(
          info.UNMASKED_RENDERER_WEBGL,
        ) as string;
        if (/Apple/i.test(renderer) && !/AMD|Intel|NVIDIA/i.test(renderer)) {
          return 'macos-arm';
        }
        if (/Apple M\d/i.test(renderer)) return 'macos-arm';
      }
    }
  } catch {
    // ignore
  }

  // maxTouchPoints ≥ 1 on Mac usually indicates Apple Silicon (or iPad-as-Mac).
  if (navigator.maxTouchPoints > 0) return 'macos-arm';

  // Default to Apple Silicon — current Mac shipping default; user can switch.
  return 'macos-arm';
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}
