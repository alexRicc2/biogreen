import type { PlatformId } from './platform';

export const GITHUB_REPO = 'alexRicc2/biogreen';
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
  platform: PlatformId | null;
}

export interface ReleaseInfo {
  id: number;
  tag: string;
  name: string;
  publishedAt: string | null;
  prerelease: boolean;
  htmlUrl: string;
  assets: ReleaseAsset[];
}

interface GhAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

interface GhRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: GhAsset[];
}

/** Classify a Tauri / GitHub release asset into a downloadable platform. */
export function classifyAsset(filename: string): PlatformId | null {
  const name = filename.toLowerCase();

  // Skip signatures, updater metadata, source archives.
  if (
    name.endsWith('.sig') ||
    name.endsWith('.json') ||
    name.endsWith('.yml') ||
    name.endsWith('.yaml') ||
    name.includes('source') ||
    name.endsWith('.tar.gz') ||
    name.endsWith('.app.tar.gz')
  ) {
    return null;
  }

  const isWindows =
    name.endsWith('.exe') ||
    name.endsWith('.msi') ||
    name.includes('windows') ||
    name.includes('nsis');

  if (isWindows) return 'windows';

  const isDmg = name.endsWith('.dmg');
  const isMacHint =
    isDmg || name.includes('darwin') || name.includes('macos') || name.includes('mac');

  if (isMacHint) {
    if (
      name.includes('aarch64') ||
      name.includes('arm64') ||
      name.includes('apple-silicon')
    ) {
      return 'macos-arm';
    }
    if (name.includes('x86_64') || name.includes('x64') || name.includes('intel')) {
      return 'macos-intel';
    }
    // Ambiguous .dmg — treat as Intel only if clearly labeled; otherwise null
    // so the picker can still list it under a generic mac row if needed.
    if (isDmg) return 'macos-intel';
  }

  if (name.endsWith('.appimage') || name.endsWith('.deb') || name.includes('linux')) {
    return 'linux';
  }

  return null;
}

function assetPriority(name: string, platform: PlatformId): number {
  const n = name.toLowerCase();
  if (platform === 'windows') {
    if (n.endsWith('.exe') && (n.includes('setup') || n.includes('nsis'))) return 0;
    if (n.endsWith('.exe')) return 1;
    if (n.endsWith('.msi')) return 2;
    return 3;
  }
  if (n.endsWith('.dmg')) return 0;
  return 1;
}

export function pickBestAsset(
  assets: ReleaseAsset[],
  platform: PlatformId,
): ReleaseAsset | null {
  const matches = assets
    .filter((a) => a.platform === platform)
    .sort(
      (a, b) =>
        assetPriority(a.name, platform) - assetPriority(b.name, platform) ||
        a.name.localeCompare(b.name),
    );
  return matches[0] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchPublishedReleases(): Promise<ReleaseInfo[]> {
  const res = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub releases unavailable (${res.status})`);
  }

  const data = (await res.json()) as GhRelease[];

  return data
    .filter((r) => !r.draft)
    .map((r) => ({
      id: r.id,
      tag: r.tag_name,
      name: r.name?.trim() || r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
      htmlUrl: r.html_url,
      assets: r.assets
        .map((a) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          browser_download_url: a.browser_download_url,
          content_type: a.content_type,
          platform: classifyAsset(a.name),
        }))
        .filter((a) => a.platform !== null && a.platform !== 'unknown'),
    }))
    .filter((r) => r.assets.length > 0);
}

/** Trigger a direct file download from a cross-origin GitHub asset URL. */
export function startAssetDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  // GitHub serves Content-Disposition: attachment; navigation starts the download.
  document.body.appendChild(a);
  a.click();
  a.remove();
}
