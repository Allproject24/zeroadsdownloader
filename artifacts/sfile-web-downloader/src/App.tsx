import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  CloudDownload,
  ExternalLink,
  File,
  Link2,
  LoaderCircle,
} from 'lucide-react';
import {
  getGetDownloadQueryKey,
  getGetDownloadedFileQueryKey,
  useCancelDownload,
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
  const queryClientInstance = useQueryClient();
  const startDownload = useStartDownload();
  const cancelDownload = useCancelDownload();

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
    startDownload.mutate({ data: { url: url.trim() } }, {
      onSuccess: (createdJob) => {
        setActiveJobId(createdJob.id);
        setDownloadError('');
        queryClientInstance.setQueryData(getGetDownloadQueryKey(createdJob.id), createdJob);
      },
      onError: (error) => {
        setStartError(error instanceof Error ? error.message : 'Permintaan tidak dapat dimulai. Silakan coba lagi.');
      },
    });
  };

  const cancelActiveJob = () => {
    if (!activeJobId) return;
    cancelDownload.mutate({ jobId: activeJobId }, {
      onSuccess: (cancelledJob) => {
        queryClientInstance.setQueryData(getGetDownloadQueryKey(activeJobId), cancelledJob);
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

  const isActive = job?.status === 'queued' || job?.status === 'running';

  return (
    <div className="app-shell">
      <header className="site-header" data-testid="header-brand">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><CloudDownload size={18} strokeWidth={2.2} /></div>
          <div className="brand-name">sfile</div>
        </div>
      </header>

      <main className="main-content">
        <section className="workspace-grid" aria-label="Ruang kerja unduhan">
          <div>
            <form className="panel submit-panel" onSubmit={submitUrl} noValidate>
              <h1 className="panel-title" data-testid="text-page-title">Unduh tautan</h1>
              <label className="url-label" htmlFor="sfile-url">Tautan</label>
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
                  placeholder="https://sfl.gl/..."
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (inputError) setInputError('');
                  }}
                  aria-describedby={inputError ? 'url-error' : undefined}
                />
              </div>
              <button className="submit-button" data-testid="button-start-download" type="submit" disabled={startDownload.isPending || isActive}>
                  {startDownload.isPending
                    ? <><LoaderCircle size={14} className="spin-icon" /> Memulai</>
                    : isActive
                      ? <>Memproses</>
                      : <>Unduh</>}
              </button>
              {inputError && <p className="input-error" id="url-error" data-testid="text-url-error">{inputError}</p>}
              {startError && <div className="error-callout" role="alert" data-testid="alert-start-error"><CircleAlert size={15} />{startError}</div>}
            </form>

            {activeJobId && <section className="panel job-panel" aria-live="polite" data-testid="panel-job-status">
              {activeJobId && jobQuery.isLoading && (
                <div className="loading-state" role="status" data-testid="state-loading">
                  <LoaderCircle className="spin-icon" size={19} aria-hidden="true" />
                  <span>Memproses...</span>
                </div>
              )}
              {activeJobId && jobQuery.isError && (
                <div className="result-error" data-testid="state-job-error">
                  <span>{jobQuery.error instanceof Error ? jobQuery.error.message : 'Status tidak dapat dimuat.'}</span>
                  <button className="retry-button" type="button" data-testid="button-retry-status" onClick={() => void jobQuery.refetch()}>Coba lagi</button>
                </div>
              )}
              {job && isActive && (
                <div className="loading-state" role="status" data-testid="state-download-loading">
                  <LoaderCircle className="spin-icon" size={19} aria-hidden="true" />
                  <span>Memproses...</span>
                  <button className="cancel-button" type="button" data-testid="button-cancel-download" onClick={cancelActiveJob} disabled={cancelDownload.isPending}>
                    {cancelDownload.isPending ? 'Menghentikan' : 'Batalkan'}
                  </button>
                </div>
              )}
              {job?.status === 'completed' && (
                <div className="terminal-result success-result" data-testid="summary-downloaded-file">
                  <div className="result-copy">
                    <strong data-testid="text-file-name">{job.fileName || 'File siap'}</strong>
                    <span className="file-size" data-testid="text-file-size">{formatSize(job.fileSize)}</span>
                  </div>
                  <button className="download-button" type="button" data-testid="button-save-file" onClick={() => void saveFile()} disabled={fileQuery.isFetching}>
                    {fileQuery.isFetching ? <LoaderCircle size={14} className="spin-icon" /> : <ArrowDownToLine size={14} />}
                    {fileQuery.isFetching ? 'Menyiapkan' : 'Simpan'}
                  </button>
                  {downloadError && <p className="download-error" role="alert" data-testid="text-download-error">{downloadError}</p>}
                </div>
              )}
              {manualSafefilekuUrl && (
                <div className="terminal-result manual-result" data-testid="text-terminal-guidance">
                  <span>Safefileku meminta verifikasi.</span>
                  <a
                    className="download-button manual-open-link"
                    data-testid="button-manual-safefileku"
                    href={manualSafefilekuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka <ExternalLink size={13} />
                  </a>
                </div>
              )}
              {job && !isActive && job.status !== 'completed' && !manualSafefilekuUrl && (
                <div className="terminal-result error-result" data-testid="text-terminal-guidance">
                  <span>{job.error || (job.status === 'cancelled' ? 'Dibatalkan.' : 'Tautan tidak dapat diproses.')}</span>
                </div>
              )}
            </section>}
          </div>
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
