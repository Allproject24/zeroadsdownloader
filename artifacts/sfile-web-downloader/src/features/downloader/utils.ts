import type { DownloadJob } from '@workspace/api-client-react';

export function formatSize(size: number | null): string {
  if (size === null || !Number.isFinite(size)) return 'Ukuran tidak tersedia';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getManualSafefilekuUrl(job: DownloadJob | null): string | null {
  if (job?.status !== 'blocked' || !job.manualUrl) return null;
  try {
    const url = new URL(job.manualUrl);
    if (
      url.protocol !== 'https:' ||
      url.origin !== 'https://safefileku.com' ||
      !/^\/download\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
