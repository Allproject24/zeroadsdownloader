import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  CloudDownload,
  ExternalLink,
  File,
  FileCheck2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
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

function formatStatus(status: DownloadJob['status']) {
  const labels: Record<DownloadJob['status'], string> = {
    queued: 'Menunggu',
    running: 'Berlangsung',
    completed: 'Selesai',
    failed: 'Gagal',
    blocked: 'Diblokir',
    cancelled: 'Dibatalkan',
  };
  return labels[status];
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
  const statusTone = job?.status === 'failed' || job?.status === 'blocked'
    ? 'failed'
    : job?.status === 'cancelled' ? 'cancelled' : '';

  return (
    <div className="app-shell">
      <header className="site-header" data-testid="header-brand">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><CloudDownload size={19} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">sfile</div>
            <div className="brand-caption">pengunduh web</div>
          </div>
        </div>
        <div className="header-note" data-testid="text-privacy-note"><ShieldCheck size={15} /> Langkah menuju file yang jelas</div>
      </header>

      <main className="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <div className="eyebrow" data-testid="text-eyebrow">Pengunduh tautan Sfile</div>
            <h1 id="hero-title" data-testid="text-page-title">Unduh file<br /><span>dengan mudah.</span></h1>
            <p className="hero-copy" data-testid="text-page-description">
              Tempel tautan Sfile untuk memulai. Jika tujuan meminta verifikasi, kami akan memberi tahu cara melanjutkan.
            </p>
          </div>
        </section>

        <section className="workspace-grid" aria-label="Ruang kerja unduhan">
          <div>
            <form className="panel submit-panel" onSubmit={submitUrl} noValidate>
              <div className="panel-topline">
                <div>
                  <div className="panel-kicker">Mulai unduhan</div>
                  <h2 className="panel-title">Tempel tautan Sfile</h2>
                </div>
                <span className="secure-chip"><ShieldCheck size={13} /> Aman</span>
              </div>
              <label className="url-label" htmlFor="sfile-url">Tautan Anda</label>
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
                  placeholder="https://sfile.mobi/..."
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (inputError) setInputError('');
                  }}
                  aria-describedby={inputError ? 'url-error' : 'url-help'}
                />
              </div>
              <button className="submit-button" data-testid="button-start-download" type="submit" disabled={startDownload.isPending || isActive}>
                  {startDownload.isPending
                    ? <><LoaderCircle size={14} className="spin-icon" /> Memulai</>
                    : isActive
                      ? <>Sedang diproses</>
                      : <>Mulai unduh <ArrowRight size={14} /></>}
              </button>
              {inputError && <p className="input-error" id="url-error" data-testid="text-url-error">{inputError}</p>}
              {startError && <div className="error-callout" role="alert" data-testid="alert-start-error"><CircleAlert size={15} />{startError}</div>}
              <p className="field-help" id="url-help" data-testid="text-url-help">
                <ShieldCheck size={13} />
                {isActive
                  ? 'Proses sedang berjalan. Tunggu hingga hasilnya muncul.'
                  : 'Mendukung tautan sfl.gl, safelinku.com, sfile.co, sfile.mobi, dan safefileku.com.'}
              </p>
              <div className="privacy-line" data-testid="text-processing-note"><LockKeyhole size={13} /> Tidak perlu masuk atau memasang aplikasi tambahan.</div>
            </form>

            <section className="panel job-panel" aria-live="polite" data-testid="panel-job-status">
              {!activeJobId && (
                <div className="empty-state" data-testid="state-empty">
                  <div className="empty-symbol"><FileCheck2 size={19} /></div>
                  <div className="empty-copy">
                    <strong>Siap memproses tautan</strong>
                    <p>Hasil unduhan akan muncul di sini.</p>
                  </div>
                </div>
              )}
              {activeJobId && jobQuery.isLoading && (
                <div className="empty-state" data-testid="state-loading">
                  <div className="empty-symbol"><LoaderCircle size={18} className="spin-icon" /></div>
                  <div className="empty-copy"><strong>Menghubungkan ke tautan</strong><p>Mengambil langkah terbaru dari server.</p></div>
                </div>
              )}
              {activeJobId && jobQuery.isError && (
                <div className="empty-state" data-testid="state-job-error">
                  <div className="empty-symbol"><CircleAlert size={19} /></div>
                  <div className="empty-copy">
                    <strong>Proses ini tidak dapat diperbarui</strong>
                    <p>{jobQuery.error instanceof Error ? jobQuery.error.message : 'Pemeriksaan progres gagal.'}</p>
                    <button className="retry-button" type="button" data-testid="button-retry-status" onClick={() => void jobQuery.refetch()}>Coba lagi</button>
                  </div>
                </div>
              )}
              {job && (
                <>
                  <div className="job-header">
                    <div className="job-header-left">
                      <span className={`status-pip ${isActive ? 'working' : statusTone}`} />
                      <div>
                        <h2 className="job-title" data-testid="text-job-title">{job.status === 'completed' ? 'File siap disimpan' : job.status === 'blocked' ? manualSafefilekuUrl ? 'Verifikasi diperlukan' : 'Tautan tidak dapat dibuka' : job.status === 'failed' ? 'Unduhan tidak selesai' : job.status === 'cancelled' ? 'Unduhan dibatalkan' : 'Menyiapkan unduhan'}</h2>
                      </div>
                    </div>
                    <span className={`status-badge ${statusTone}`} data-testid="status-download-job">
                      {isActive && <LoaderCircle className="spin-icon" size={11} />}
                      {job.status === 'completed' && <Check size={11} />}
                      {formatStatus(job.status)}
                    </span>
                  </div>
                  <div className="job-content">
                    {isActive && (
                      <div className="loading-state" role="status" data-testid="state-download-loading">
                        <span className="loading-indicator" aria-hidden="true"><LoaderCircle className="spin-icon" size={20} /></span>
                        <div className="loading-copy">
                          <strong>Memproses tautan</strong>
                          <p>Mohon tunggu sebentar, file sedang disiapkan.</p>
                        </div>
                        <button className="cancel-button" type="button" data-testid="button-cancel-download" onClick={cancelActiveJob} disabled={cancelDownload.isPending}>
                          {cancelDownload.isPending ? 'Menghentikan…' : 'Batalkan'}
                        </button>
                      </div>
                    )}
                    {job.status === 'completed' && (
                      <>
                        <div className="terminal-result success-result" data-testid="summary-downloaded-file">
                          <div className="result-icon"><File size={17} /></div>
                          <div className="result-copy">
                            <strong>File siap disimpan</strong>
                            <span className="file-name" title={job.fileName || 'File unduhan'} data-testid="text-file-name">{job.fileName || 'File unduhan'}</span>
                            <span className="file-size" data-testid="text-file-size">{formatSize(job.fileSize)}</span>
                          </div>
                          <Check className="result-check" size={18} aria-hidden="true" />
                        </div>
                        <button className="download-button" type="button" data-testid="button-save-file" onClick={() => void saveFile()} disabled={fileQuery.isFetching}>
                          {fileQuery.isFetching ? <LoaderCircle size={14} className="spin-icon" /> : <ArrowDownToLine size={14} />}
                          {fileQuery.isFetching ? 'Menyiapkan file' : 'Simpan file'}
                        </button>
                        {downloadError && <p className="download-error" role="alert" data-testid="text-download-error">{downloadError}</p>}
                      </>
                    )}
                    {manualSafefilekuUrl && (
                      <div className="terminal-result manual-result" data-testid="text-terminal-guidance">
                        <div className="result-icon"><ShieldCheck size={17} /></div>
                        <div className="result-copy">
                          <strong>Verifikasi di Safefileku</strong>
                          <span>Safefileku meminta verifikasi manusia. Selesaikan di situs tersebut untuk mengunduh file.</span>
                        </div>
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
                    {job.status !== 'completed' && !manualSafefilekuUrl && !isActive && (
                      <div className="terminal-result error-result" data-testid="text-terminal-guidance">
                        <div className="result-icon"><CircleAlert size={17} /></div>
                        <div className="result-copy">
                          <strong>{job.status === 'blocked' ? 'Tujuan tidak dapat dibuka dengan aman' : job.status === 'cancelled' ? 'Proses dibatalkan' : 'Unduhan tidak selesai'}</strong>
                          <span>{job.error || (job.status === 'cancelled' ? 'Anda dapat memulai proses baru kapan saja.' : 'Silakan periksa tautan dan coba lagi.')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

        </section>
      </main>

      <footer className="site-footer" data-testid="footer-service-note">
        <span><span className="footer-mark">SFILE</span> &nbsp;PELACAK TAUTAN</span>
        <span>Hanya pengalihan yang didukung yang akan diikuti.</span>
      </footer>
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
