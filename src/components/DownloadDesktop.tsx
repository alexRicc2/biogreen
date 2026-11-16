import { useEffect, useMemo, useState } from 'react';
import {
  fetchPublishedReleases,
  formatBytes,
  pickBestAsset,
  RELEASES_PAGE_URL,
  startAssetDownload,
  type ReleaseInfo,
} from '../utils/githubReleases';
import {
  detectPlatform,
  DOWNLOADABLE_PLATFORMS,
  platformLabel,
  platformShortLabel,
  type PlatformId,
} from '../utils/platform';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; releases: ReleaseInfo[] };

function availablePlatforms(release: ReleaseInfo | null): PlatformId[] {
  if (!release) return [];
  const present = new Set(
    release.assets.map((a) => a.platform).filter(Boolean) as PlatformId[],
  );
  return DOWNLOADABLE_PLATFORMS.filter((p) => present.has(p));
}

export default function DownloadDesktop() {
  const [detected, setDetected] = useState<PlatformId>('unknown');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('windows');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const platform = detectPlatform();
    setDetected(platform);
    if (platform === 'windows' || platform === 'macos-arm' || platform === 'macos-intel') {
      setSelectedPlatform(platform);
    } else {
      setSelectedPlatform('windows');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const releases = await fetchPublishedReleases();
        if (cancelled) return;
        setLoad({ status: 'ready', releases });
        if (releases[0]) setSelectedTag(releases[0].tag);
      } catch (err) {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load releases',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const releases = load.status === 'ready' ? load.releases : [];
  const selectedRelease = useMemo(
    () => releases.find((r) => r.tag === selectedTag) ?? releases[0] ?? null,
    [releases, selectedTag],
  );

  const platforms = availablePlatforms(selectedRelease);

  useEffect(() => {
    if (!selectedRelease) return;
    const available = availablePlatforms(selectedRelease);
    if (available.length === 0) return;
    if (!available.includes(selectedPlatform)) {
      // Prefer detected OS when switching versions, else first available.
      if (available.includes(detected)) {
        setSelectedPlatform(detected);
      } else {
        setSelectedPlatform(available[0]);
      }
    }
  }, [selectedRelease, selectedPlatform, detected]);

  const asset = selectedRelease
    ? pickBestAsset(selectedRelease.assets, selectedPlatform)
    : null;

  const isRecommended =
    detected !== 'unknown' &&
    detected !== 'linux' &&
    selectedPlatform === detected;

  const onDownload = () => {
    if (!asset) return;
    startAssetDownload(asset.browser_download_url);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="group min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight text-slate-900 group-hover:text-slate-700">
              BIOGREEN
            </p>
            <p className="truncate text-xs text-slate-500">
              Circular Bioeconomy Material Metric
            </p>
          </a>
          <a
            href="/"
            className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open web app
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Desktop app
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Download BIOGREEN
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          Offline Windows and macOS builds of the same assessment workspace — no
          browser required.
        </p>

        <section className="mt-10 space-y-6">
          {load.status === 'loading' && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Checking latest releases…
            </div>
          )}

          {load.status === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
              <p className="font-medium">Could not load downloads</p>
              <p className="mt-1 text-red-700">{load.message}</p>
              <a
                href={RELEASES_PAGE_URL}
                className="mt-3 inline-block font-medium text-red-900 underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                View releases on GitHub
              </a>
            </div>
          )}

          {load.status === 'ready' && releases.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
              <p className="font-medium">No published desktop builds yet</p>
              <p className="mt-1 text-amber-900/80">
                Builds appear here after a version tag is published on GitHub.
                You can still use the full web app in the meantime.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="/"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Use web app
                </a>
                <a
                  href={RELEASES_PAGE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-50"
                >
                  GitHub releases
                </a>
              </div>
            </div>
          )}

          {load.status === 'ready' && selectedRelease && (
            <>
              {detected !== 'unknown' && detected !== 'linux' && (
                <p className="text-sm text-slate-600">
                  Detected{' '}
                  <span className="font-medium text-slate-900">
                    {platformLabel(detected)}
                  </span>
                  {isRecommended ? ' — recommended build selected.' : '.'}
                </p>
              )}
              {(detected === 'linux' || detected === 'unknown') && (
                <p className="text-sm text-slate-600">
                  {detected === 'linux'
                    ? 'Linux builds are not packaged yet — pick Windows or macOS if you need a desktop binary on another machine.'
                    : 'Select your operating system below.'}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">
                    Version
                  </span>
                  <select
                    value={selectedRelease.tag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    {releases.map((r) => (
                      <option key={r.tag} value={r.tag}>
                        {r.name}
                        {r.prerelease ? ' (pre-release)' : ''}
                        {r === releases[0] ? ' — latest' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">
                    Platform
                  </span>
                  <select
                    value={selectedPlatform}
                    onChange={(e) =>
                      setSelectedPlatform(e.target.value as PlatformId)
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    {(platforms.length > 0 ? platforms : DOWNLOADABLE_PLATFORMS).map(
                      (p) => (
                        <option key={p} value={p} disabled={!platforms.includes(p)}>
                          {platformShortLabel(p)}
                          {p === detected ? ' — recommended' : ''}
                          {!platforms.includes(p) ? ' (unavailable)' : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                {asset ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {isRecommended ? 'Recommended for you' : 'Selected build'}
                        </p>
                        <p className="mt-1 font-display text-xl font-semibold text-slate-900">
                          {platformLabel(selectedPlatform)}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {asset.name}
                          <span className="text-slate-400"> · </span>
                          <span className="tabular-nums">{formatBytes(asset.size)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onDownload}
                        className="shrink-0 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Download now
                      </button>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-slate-500">
                      Download starts immediately from GitHub Releases. Builds are not
                      Apple-notarized yet — see macOS install notes below if Gatekeeper
                      blocks the app.
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-900">
                      No installer for this platform in {selectedRelease.tag}
                    </p>
                    <p className="mt-1">
                      Choose another platform above, or{' '}
                      <a
                        href={selectedRelease.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-900 underline underline-offset-2"
                      >
                        browse assets on GitHub
                      </a>
                      .
                    </p>
                  </div>
                )}
              </div>

              {(selectedPlatform === 'macos-arm' ||
                selectedPlatform === 'macos-intel') && (
                <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 open:pb-4">
                  <summary className="cursor-pointer font-medium text-slate-900">
                    macOS says the app is “damaged”?
                  </summary>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                    <p>
                      Gatekeeper blocks unsigned downloads and shows that message even
                      when the build is fine. After opening the{' '}
                      <span className="font-medium text-slate-800">.dmg</span> and
                      dragging BIOGREEN to Applications, clear the quarantine flag:
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2.5 font-mono text-xs text-slate-100">
                      {`xattr -cr /Applications/BIOGREEN.app\nopen /Applications/BIOGREEN.app`}
                    </pre>
                    <p className="text-xs text-slate-500">
                      Right-click → Open does not fix the “damaged” dialog. Proper
                      Apple Developer ID signing + notarization will remove this step
                      in a future release.
                    </p>
                  </div>
                </details>
              )}

              {platforms.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    All builds in this release
                  </p>
                  <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                    {platforms.map((p) => {
                      const a = pickBestAsset(selectedRelease.assets, p);
                      if (!a) return null;
                      return (
                        <li
                          key={p}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                              {platformShortLabel(p)}
                              {p === detected && (
                                <span className="ml-2 text-xs font-normal text-emerald-700">
                                  recommended
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {a.name} · {formatBytes(a.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startAssetDownload(a.browser_download_url)}
                            className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <p className="mt-12 text-center text-xs text-slate-400">
          Prefer the browser?{' '}
          <a href="/" className="text-slate-600 underline underline-offset-2">
            Run BIOGREEN online
          </a>
        </p>
      </main>
    </div>
  );
}
