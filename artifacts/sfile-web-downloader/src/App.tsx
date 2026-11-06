import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  CloudDownload,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
} from 'lucide-react';
import {
  getGetDownloadQueryKey,
  getGetDownloadedFileQueryKey,
  useGetDownload,
  useGetDownloadedFile,
  useStartDownload,
} from '@workspace/api-client-react';
import type { DownloadJob } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import './index.css';

const queryClient = new QueryClient();

function formatSize(size: number | null) {
  if (size === null || !Number.isFinite(size)) return 'Ukuran tidak tersedia';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getManualSafefilekuUrl(job: DownloadJob | undefined): string | null {
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

function Home() {
  const [url, setUrl] = useState('');
  const [activeJobId, setActiveJobId] = useState('');
  const [inputError, setInputError] = useState('');
  const [startError, setStartError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(1);
  const queryClientInstance = useQueryClient();
  const startDownload = useStartDownload();

  const jobQuery = useGetDownload(activeJobId, {
    query: {
      enabled: Boolean(activeJobId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'queued' || status === 'running' ? 1600 : false;
      },
      queryKey: getGetDownloadQueryKey(activeJobId),
    },
    request: { cache: 'no-store' },
  });
  const job = jobQuery.data;
  const manualSafefilekuUrl = getManualSafefilekuUrl(job);
  const fileQuery = useGetDownloadedFile(activeJobId, {
    query: {
      enabled: false,
      queryKey: getGetDownloadedFileQueryKey(activeJobId),
    },
  });

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInputError('');
    setStartError('');
    if (job?.status === 'queued' || job?.status === 'running') return;
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
    setStartedAt(Date.now());
    setElapsedSeconds(1);
    setActiveJobId('');
    startDownload.mutate({ data: { url: url.trim() } }, {
      onSuccess: (createdJob) => {
        setActiveJobId(createdJob.id);
        setDownloadError('');
        setCopyFeedback('');
        queryClientInstance.setQueryData(getGetDownloadQueryKey(createdJob.id), createdJob);
      },
      onError: (error) => {
        setStartedAt(null);
        setElapsedSeconds(1);
        setStartError(error instanceof Error ? error.message : 'Permintaan tidak dapat dimulai. Silakan coba lagi.');
      },
    });
  };

  const saveFile = async () => {
    setDownloadError('');
    const result = await fileQuery.refetch();
    if (result.error || !result.data) {
      setDownloadError(result.error instanceof Error ? result.error.message : 'File tidak dapat diambil. Silakan coba lagi.');
      return;
    }
    const blob = result.data;
    const objectUrl = URL.createObjectURL(blob);
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

  const isActive = job?.status === 'queued' || job?.status === 'running';
  const isProcessing =
    startDownload.isPending ||
    isActive ||
    (Boolean(activeJobId) && jobQuery.isLoading && !job);

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
            <div className="brand-mark" aria-hidden="true"><CloudDownload size={21} strokeWidth={2} /></div>
            <h1 id="page-title" className="card-title" data-testid="text-page-title">Malz Bypass URL</h1>
            <p className="card-subtitle">BYPASS SEMUA SHORT LINK</p>
            <p className="card-description">
              Bypass <strong>SFL.GL</strong> · <strong>SFILE.CO</strong> · <strong>SFILE.MOBI</strong> · <strong>SAFELINKU</strong> · <strong>SAFILEKU</strong>
            </p>
          </div>

          <form className="download-form" onSubmit={submitUrl} noValidate>
            <label className="screen-reader" htmlFor="sfile-url">Tautan Sfile</label>
            <div className="url-input-wrap">
              <Link2 className="url-input-icon" size={16} aria-hidden="true" />
              <input
                id="sfile-url"
                className="url-input"
                data-testid="input-sfile-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                maxLength={2048}
                placeholder="https://sfl.gl/xxxxx"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (inputError) setInputError('');
                }}
                aria-describedby={inputError ? 'url-error' : undefined}
              />
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

          {activeJobId && !isProcessing && (
            <section className="job-panel" aria-live="polite" data-testid="panel-job-status">
              {jobQuery.isError && (
                <div className="result-error" data-testid="state-job-error">
                  <span>{jobQuery.error instanceof Error ? jobQuery.error.message : 'Status tidak dapat dimuat.'}</span>
                  <button className="retry-button" type="button" data-testid="button-retry-status" onClick={() => void jobQuery.refetch()}>Coba lagi</button>
                </div>
              )}
              {job?.status === 'completed' && (
                <div className="result-card success-result" data-testid="summary-downloaded-file">
                  <div className="result-eyebrow">FILE HASIL</div>
                  <div className="result-copy">
                    <strong data-testid="text-file-name">{job.fileName || 'File siap'}</strong>
                    <span data-testid="text-file-size">{formatSize(job.fileSize)}</span>
                  </div>
                  <button className="download-button" type="button" data-testid="button-save-file" onClick={() => void saveFile()} disabled={fileQuery.isFetching}>
                    {fileQuery.isFetching ? <LoaderCircle size={14} className="spin-icon" /> : <ArrowDownToLine size={14} />}
                    {fileQuery.isFetching ? 'Menyiapkan' : 'Simpan'}
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
              {job && !isActive && job.status !== 'completed' && !manualSafefilekuUrl && (
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
          <div className="card-footer">© 2026 Malz Bypass URL</div>
        </section>
      </main>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
