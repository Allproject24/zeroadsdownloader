import type { DownloadJob } from '@workspace/api-client-react';

export type DownloadResult =
  | {
      kind: 'file';
      blob: Blob;
      fileName: string;
      fileSize: number;
      jobId: string;
    }
  | {
      kind: 'job';
      job: DownloadJob;
    };

export async function runDownload(url: string): Promise<DownloadResult> {
  const response = await fetch('/api/downloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    cache: 'no-store',
  });

  if (response.ok && response.headers.get('x-download-result') === 'file') {
    const encodedFileName = response.headers.get('x-download-file-name');
    let fileName = 'unduhan';
    if (encodedFileName) {
      try {
        fileName = decodeURIComponent(encodedFileName);
      } catch {
        fileName = 'unduhan';
      }
    }

    return {
      kind: 'file',
      blob: await response.blob(),
      fileName,
      fileSize: Number(response.headers.get('x-download-file-size')) || 0,
      jobId: response.headers.get('x-download-id') || crypto.randomUUID(),
    };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Permintaan tidak dapat diproses. Silakan coba lagi.';
    throw new Error(message);
  }

  if (!body || typeof body !== 'object' || !('status' in body)) {
    throw new Error('Respons server tidak dapat dibaca. Silakan coba lagi.');
  }

  return { kind: 'job', job: body as DownloadJob };
}
