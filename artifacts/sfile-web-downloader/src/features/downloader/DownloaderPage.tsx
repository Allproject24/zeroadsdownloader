import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  X,
} from 'lucide-react';
import type { DownloadJob } from '@workspace/api-client-react';
import GhostMark from '@/components/GhostMark';
import { runDownload } from './download-api';
import { formatSize, getManualSafefilekuUrl } from './utils';

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<Blob | null>(null);
  const [inputError, setInputError] = useState('');
  const [startError, setStartError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(1);
  const manualSafefilekuUrl = getManualSafefilekuUrl(job);
  const isProcessing = isStarting;

  const submitUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInputError('');
    setStartError('');
    if (isProcessing) return;

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setInputError('Masukkan tautan lengkap, termasuk https://');
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      setInputError('Tautan harus menggunakan http:// atau https://');
      return;
    }
    if (url.trim().length > 2048) {
      setInputError('Tautan ini melebihi batas 2.048 karakter.');
      return;
    }

    setJob(null);
    setDownloadedFile(null);
    setDownloadError('');
    setCopyFeedback('');
    setIsStarting(true);
    setStartedAt(Date.now());
    setElapsedSeconds(1);

    try {
      const result = await runDownload(url.trim());
      if (result.kind === 'file') {
        setDownloadedFile(result.blob);
        setJob({
          id: result.jobId,
          status: 'completed',
          message: 'File siap diunduh.',
          steps: [],
          fileName: result.fileName,
          fileSize: result.fileSize,
          error: null,
          manualUrl: null,
        });
      } else {
        setJob(result.job);
      }
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : 'Permintaan tidak dapat dimulai. Silakan coba lagi.',
      );
    } finally {
      setIsStarting(false);
      setStartedAt(null);
    }
  };

  const saveFile = () => {
    setDownloadError('');
    if (!downloadedFile) {
      setDownloadError('File tidak tersedia. Silakan mulai unduhan lagi.');
      return;
    }
    const objectUrl = URL.createObjectURL(downloadedFile);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = job?.fileName || 'unduhan';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const copyManualUrl = async () => {
    if (!manualSafefilekuUrl) return;
    try {
      await navigator.clipboard.writeText(manualSafefilekuUrl);
      setCopyFeedback('URL disalin');
    } catch {
      setCopyFeedback('URL tidak dapat disalin.');
    }
  };

  useEffect(() => {
    if (startedAt === null || !isProcessing) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000) + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isProcessing, startedAt]);

  return (
    <div className="app-shell">
      <main className="main-content">
        <section className="downloader-card" aria-labelledby="page-title">
          <div className="card-brand" data-testid="header-brand">
            <div className="brand-mark" aria-hidden="true"><GhostMark /></div>
            <h1 id="page-title" className="card-title" data-testid="text-page-title">ZeroAds Downloader</h1>
            <p className="card-subtitle">BYPASS SEMUA SHORT LINK</p>
            <p className="card-description">
              Bypass <strong>sfl.gl</strong> · <strong>sfile.co</strong> · <strong>sfile.mobi</strong> · <strong>SafelinkU</strong> · <strong>Safefileku</strong><span className="card-description-tail">, dan lain-lain.</span>
            </p>
          </div>

          <form className="download-form" onSubmit={submitUrl} noValidate>
            <label className="screen-reader" htmlFor="sfile-url">Tautan Sfile</label>
            <div className="url-input-wrap">
              <Link2 className="url-input-icon" size={16} aria-hidden="true" />
              <input
                id="sfile-url"
                ref={urlInputRef}
                className="url-input"
                data-testid="input-sfile-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                maxLength={2048}
                placeholder="Tempel link shortlink di sini"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (inputError) setInputError('');
                }}
                aria-describedby={inputError ? 'url-error' : undefined}
              />
              {url && (
                <button
                  className="clear-url-button"
                  data-testid="button-clear-url"
                  type="button"
                  aria-label="Hapus URL"
                  title="Hapus URL"
                  onClick={() => {
                    setUrl('');
                    setInputError('');
                    urlInputRef.current?.focus();
                  }}
                >
                  <X size={14} strokeWidth={2.25} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              className="submit-button"
              data-testid="button-start-download"
              type="submit"
              disabled={isProcessing}
              aria-busy={isProcessing}
            >
              {isProcessing
                ? <>
                    <LoaderCircle size={14} className="spin-icon" aria-hidden="true" />
                    <span>Memproses</span>
                    <span className="button-timer" data-testid="text-elapsed-time" aria-live="off">{elapsedSeconds}s</span>
                  </>
                : <span>Bypass</span>}
            </button>
            {inputError && <p className="input-error" id="url-error" data-testid="text-url-error">{inputError}</p>}
            {startError && <div className="error-callout" role="alert" data-testid="alert-start-error"><CircleAlert size={15} />{startError}</div>}
          </form>

          {job && !isProcessing && (
            <section className="job-panel" aria-live="polite" data-testid="panel-job-status">
              {job.status === 'completed' && (
                <div className="result-card success-result" data-testid="summary-downloaded-file">
                  <div className="result-eyebrow">FILE HASIL</div>
                  <div className="result-copy">
                    <strong data-testid="text-file-name">{job.fileName || 'File siap'}</strong>
                    <span data-testid="text-file-size">{formatSize(job.fileSize)}</span>
                  </div>
                  <button className="download-button" type="button" data-testid="button-save-file" onClick={saveFile} disabled={!downloadedFile}>
                    <ArrowDownToLine size={14} />
                    Simpan
                  </button>
                  {downloadError && <p className="download-error" role="alert" data-testid="text-download-error">{downloadError}</p>}
                </div>
              )}
              {manualSafefilekuUrl && (
                <div className="result-card manual-result" data-testid="text-terminal-guidance">
                  <div className="result-eyebrow">LINK ASLI</div>
                  <code className="manual-url">{manualSafefilekuUrl}</code>
                  <div className="result-actions">
                    <button className="result-action" type="button" onClick={() => void copyManualUrl()}>
                      {copyFeedback === 'URL disalin' ? <Check size={15} /> : <Copy size={15} />}
                      {copyFeedback === 'URL disalin' ? 'Tersalin' : 'Salin URL'}
                    </button>
                    <a
                      className="result-action"
                      data-testid="button-manual-safefileku"
                      href={manualSafefilekuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka Link <ExternalLink size={14} />
                    </a>
                  </div>
                  {copyFeedback && copyFeedback !== 'URL disalin' && <p className="copy-feedback" role="alert">{copyFeedback}</p>}
                </div>
              )}
              {job.status !== 'completed' && !manualSafefilekuUrl && (
                <div className="result-card error-result" data-testid="text-terminal-guidance">
                  <CircleAlert size={17} aria-hidden="true" />
                  <span>{job.error || (job.status === 'cancelled' ? 'Dibatalkan.' : 'Tautan tidak dapat diproses.')}</span>
                </div>
              )}
            </section>
          )}

          <div className="service-tags" aria-label="Keunggulan layanan">
            <span>Bypass Iklan</span>
            <span>Bebas Shortlink</span>
            <span>Cepat &amp; Mudah</span>
            <span>Support All Device</span>
          </div>

          <div className="card-divider" aria-hidden="true" />
          <div className="card-footer">© 2026 ZeroAds Downloader</div>
        </section>
      </main>
    </div>
  );
}
