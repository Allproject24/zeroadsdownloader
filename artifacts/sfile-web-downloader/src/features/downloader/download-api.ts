import type { DownloadJob } from '@workspace/api-client-react';

export type DownloadResult =
  | {
      kind: 'file';
      job: DownloadJob;
      blob: Blob;
      fileName: string;
      fileSize: number;
    }
  | {
      kind: 'job';
      job: DownloadJob;
    };

type StreamRecord =
  | { type: 'job'; job: DownloadJob }
  | {
      type: 'step';
      id: string;
      status: DownloadJob['status'];
      message: string;
      step: DownloadJob['steps'][number];
    }
  | {
      type: 'end';
      job: DownloadJob;
      file: DownloadFileMetadata | null;
    }
  | { type: 'error'; message: string };

type DownloadFileMetadata = { fileName: string; fileSize: number };

function isDownloadJob(value: unknown): value is DownloadJob {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'status' in value &&
    typeof value.status === 'string' &&
    'steps' in value &&
    Array.isArray(value.steps)
  );
}

function isDownloadFileMetadata(value: unknown): value is DownloadFileMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fileName' in value &&
    typeof value.fileName === 'string' &&
    'fileSize' in value &&
    typeof value.fileSize === 'number' &&
    Number.isFinite(value.fileSize) &&
    value.fileSize >= 0
  );
}

function isDownloadStatus(value: unknown): value is DownloadJob['status'] {
  return ['queued', 'running', 'completed', 'failed', 'blocked', 'cancelled'].includes(
    String(value),
  );
}

function isDownloadStep(value: unknown): value is DownloadJob['steps'][number] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'kind' in value &&
    ['open', 'wait', 'scroll', 'click', 'redirect', 'download', 'notice'].includes(
      String(value.kind),
    ) &&
    'message' in value &&
    typeof value.message === 'string' &&
    'url' in value &&
    (typeof value.url === 'string' || value.url === null)
  );
}

function parseRecord(line: string): StreamRecord {
  const parsed: unknown = JSON.parse(line);
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    throw new Error('Log proses tidak dapat dibaca dari server.');
  }

  if (parsed.type === 'error' && 'message' in parsed && typeof parsed.message === 'string') {
    return { type: 'error', message: parsed.message };
  }
  if (
    parsed.type === 'job' &&
    'job' in parsed &&
    isDownloadJob(parsed.job)
  ) {
    return { type: 'job', job: parsed.job };
  }
  if (
    parsed.type === 'step' &&
    'id' in parsed &&
    typeof parsed.id === 'string' &&
    'status' in parsed &&
    isDownloadStatus(parsed.status) &&
    'message' in parsed &&
    typeof parsed.message === 'string' &&
    'step' in parsed &&
    isDownloadStep(parsed.step)
  ) {
    return {
      type: 'step',
      id: parsed.id,
      status: parsed.status,
      message: parsed.message,
      step: parsed.step,
    };
  }
  if (
    parsed.type === 'end' &&
    'job' in parsed &&
    isDownloadJob(parsed.job) &&
    'file' in parsed
  ) {
    const file = parsed.file;
    if (file !== null && !isDownloadFileMetadata(file)) {
      throw new Error('Informasi file dari server tidak valid.');
    }
    return { type: 'end', job: parsed.job, file };
  }

  throw new Error('Respons proses dari server tidak dikenali.');
}

function getResponseError(body: unknown): string | null {
  return body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof body.error === 'string'
    ? body.error
    : null;
}

export async function runDownload(
  url: string,
  onJobUpdate: (job: DownloadJob) => void,
  onDiagnostic: (message: string) => void,
): Promise<DownloadResult> {
  onDiagnostic('Permintaan proses dikirim ke server.');

  let response: Response;
  try {
    response = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      cache: 'no-store',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Koneksi ke server gagal.';
    onDiagnostic(`Permintaan tidak mencapai server: ${message}`);
    throw error;
  }

  onDiagnostic(`Server merespons HTTP ${response.status}.`);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(
      getResponseError(body) || 'Permintaan tidak dapat diproses. Silakan coba lagi.',
    );
  }
  if (!response.body) {
    throw new Error('Server tidak mengirim aliran log proses.');
  }

  const reader = response.body.getReader();
  let pending = new Uint8Array();
  let endRecord: Extract<StreamRecord, { type: 'end' }> | null = null;
  let latestJob: DownloadJob | null = null;
  let serverError: string | null = null;
  const fileChunks: ArrayBuffer[] = [];
  let receivedFileBytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value?.byteLength) {
        const combined = new Uint8Array(pending.byteLength + value.byteLength);
        combined.set(pending);
        combined.set(value, pending.byteLength);
        pending = combined;
      }

      while (!endRecord && !serverError) {
        const newlineIndex = pending.indexOf(10);
        if (newlineIndex < 0) break;
        const line = new TextDecoder()
          .decode(pending.slice(0, newlineIndex))
          .replace(/\r$/, '')
          .trim();
        pending = pending.slice(newlineIndex + 1);
        if (!line) continue;

        const record = parseRecord(line);
        if (record.type === 'error') {
          serverError = record.message;
        } else if (record.type === 'job') {
          latestJob = record.job;
          onJobUpdate(latestJob);
        } else if (record.type === 'step') {
          if (!latestJob || latestJob.id !== record.id) {
            throw new Error('Log langkah tidak cocok dengan proses yang sedang berjalan.');
          }
          const currentJob = latestJob as DownloadJob;
          const updatedJob: DownloadJob = {
            ...currentJob,
            status: record.status,
            message: record.message,
            steps: [...currentJob.steps, record.step],
          };
          latestJob = updatedJob;
          onJobUpdate(updatedJob);
        } else {
          latestJob = record.job;
          onJobUpdate(record.job);
          endRecord = record;
        }
      }

      if (endRecord?.file) {
        const remaining = endRecord.file.fileSize - receivedFileBytes;
        if (remaining > 0 && pending.byteLength > 0) {
          const length = Math.min(remaining, pending.byteLength);
          fileChunks.push(pending.slice(0, length).buffer as ArrayBuffer);
          receivedFileBytes += length;
          pending = pending.slice(length);
        }
      }

      if (serverError) throw new Error(serverError);
      if (done) break;
    }
  } catch (error) {
    onDiagnostic(
      `Aliran proses terhenti: ${
        error instanceof Error ? error.message : 'kesalahan baca respons'
      }`,
    );
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!endRecord) {
    throw new Error('Koneksi berakhir sebelum server mengirim hasil akhir.');
  }
  if (!endRecord.file) {
    return { kind: 'job', job: endRecord.job };
  }
  if (receivedFileBytes !== endRecord.file.fileSize) {
    throw new Error(
      `File belum terkirim utuh (${receivedFileBytes}/${endRecord.file.fileSize} byte).`,
    );
  }

  const blob = new Blob(fileChunks, { type: 'application/octet-stream' });
  onDiagnostic(`File diterima: ${endRecord.file.fileName} (${receivedFileBytes} byte).`);
  return {
    kind: 'file',
    job: endRecord.job,
    blob,
    fileName: endRecord.file.fileName,
    fileSize: endRecord.file.fileSize,
  };
}
