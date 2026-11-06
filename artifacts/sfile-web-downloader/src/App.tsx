import { useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  CloudDownload,
  ExternalLink,
  File,
  FileCheck2,
  FileSearch,
  Link2,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getGetDownloadQueryKey,
  getGetDownloadedFileQueryKey,
  useCancelDownload,
  useGetDownload,
  useGetDownloadedFile,
  useStartDownload,
} from '@workspace/api-client-react';
import type { DownloadJob, DownloadStep } from '@workspace/api-client-react';
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

function stepIcon(kind: DownloadStep['kind']) {
  switch (kind) {
    case 'open': return <ExternalLink size={12} />;
    case 'wait': return <Clock3 size={12} />;
    case 'click': return <ArrowRight size={12} />;
    case 'redirect': return <RotateCcw size={12} />;
    case 'download': return <ArrowDownToLine size={12} />;
    default: return <CircleAlert size={12} />;
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
  const isTerminal = job && !isActive;
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
            <div className="eyebrow" data-testid="text-eyebrow">Tautan singkat, jadi mudah</div>
            <h1 id="hero-title" data-testid="text-page-title">File Anda,<br /><span>tanpa berputar-putar.</span></h1>
            <p className="hero-copy" data-testid="text-page-description">
              Tempel tautan Sfile yang didukung. Kami akan mengikuti setiap langkah dan menunjukkan prosesnya hingga file ditemukan.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit" />
            <Sparkles className="spark spark-one" size={18} />
            <Sparkles className="spark spark-two" size={14} />
            <div className="artifact-card">
              <FileCheck2 className="artifact-icon" size={34} strokeWidth={1.5} />
              <div className="artifact-line" />
              <div className="artifact-line short" />
              <div className="artifact-line" />
              <div className="artifact-tag">SIAP DISIMPAN</div>
            </div>
          </div>
        </section>

        <section className="workspace-grid" aria-label="Ruang kerja unduhan">
          <div>
            <form className="panel submit-panel" onSubmit={submitUrl} noValidate>
              <div className="panel-topline">
                <div>
                  <div className="panel-kicker">Mulai di sini</div>
                  <h2 className="panel-title">Tempel tautan Sfile</h2>
                </div>
                <span className="step-number">01 / 01</span>
              </div>
              <label className="url-label" htmlFor="sfile-url">Tautan singkat</label>
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
                <button className="submit-button" data-testid="button-start-download" type="submit" disabled={startDownload.isPending || isActive}>
                  {startDownload.isPending
                    ? <><LoaderCircle size={14} className="spin-icon" /> Memulai</>
                    : isActive
                      ? <>Proses berlangsung <ArrowRight size={14} /></>
                      : <>Ikuti tautan <ArrowRight size={14} /></>}
                </button>
              </div>
              {inputError && <p className="input-error" id="url-error" data-testid="text-url-error">{inputError}</p>}
              {startError && <div className="error-callout" role="alert" data-testid="alert-start-error"><CircleAlert size={15} />{startError}</div>}
              <p className="field-help" id="url-help" data-testid="text-url-help">
                <ShieldCheck size={13} />
                {isActive
                  ? 'Selesaikan atau batalkan proses aktif sebelum mengirim tautan lain.'
                  : 'Hanya tautan singkat Sfile yang didukung. Kami akan memberi tahu jika tautan tidak dapat diikuti.'}
              </p>
              <div className="privacy-line" data-testid="text-processing-note"><LockKeyhole size={13} /> Kami hanya memproses tautan yang Anda kirim. Tak perlu masuk.</div>
            </form>

            <section className="panel job-panel" aria-live="polite" data-testid="panel-job-status">
              {!activeJobId && (
                <div className="empty-state" data-testid="state-empty">
                  <div className="empty-symbol"><FileSearch size={19} /></div>
                  <div className="empty-copy">
                    <strong>Belum ada proses</strong>
                    <p>Rute dan progres tautan akan muncul di sini setelah Anda mengirimkannya.</p>
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
                        <h2 className="job-title" data-testid="text-job-title">{job.status === 'completed' ? 'File ditemukan' : job.status === 'blocked' ? 'Tautan diblokir' : job.status === 'failed' ? 'Proses tidak selesai' : job.status === 'cancelled' ? 'Proses dibatalkan' : 'Mengikuti tautan'}</h2>
                        <p className="job-subtitle" data-testid="text-job-id">Proses · {job.id}</p>
                      </div>
                    </div>
                    <span className={`status-badge ${statusTone}`} data-testid="status-download-job">
                      {isActive && <LoaderCircle className="spin-icon" size={11} />}
                      {job.status === 'completed' && <Check size={11} />}
                      {formatStatus(job.status)}
                    </span>
                  </div>
                  <div className="job-content">
                    <p className="job-message" data-testid="text-job-message">{job.message}</p>
                    {job.error && (
                      <div className="error-callout" role="alert" data-testid="alert-job-error"><CircleAlert size={15} />{job.error}</div>
                    )}
                    <div className="steps-label">
                      <span>Langkah yang sudah dilakukan</span>
                      <span className="step-count" data-testid="text-step-count">{job.steps.length} langkah</span>
                    </div>
                    {job.steps.length > 0 ? (
                      <div className="timeline" data-testid="list-download-steps">
                        {job.steps.map((step, index) => (
                          <div className="timeline-row" key={step.id} data-testid={`row-download-step-${step.id}`}>
                            <div className="timeline-rail">
                              <span className="timeline-node">{stepIcon(step.kind)}</span>
                              {index !== job.steps.length - 1 && <span className="timeline-line" />}
                            </div>
                            <div className="timeline-copy">
                              <p className="timeline-message" data-testid={`text-step-message-${step.id}`}>{step.message}</p>
                              {step.url && <span className="timeline-url" title={step.url} data-testid={`text-step-url-${step.id}`}>{step.url}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state" data-testid="state-no-steps">
                        <div className="empty-copy"><strong>Menunggu langkah pertama</strong><p>Server belum melaporkan pengalihan atau jeda.</p></div>
                      </div>
                    )}
                    {isTerminal && (
                      <div className="job-actions" data-testid="group-job-actions">
                        {job.status === 'completed' ? (
                          <>
                            <div className="file-summary" data-testid="summary-downloaded-file">
                              <div className="file-icon"><File size={17} /></div>
                              <div>
                                <div className="file-name" title={job.fileName || 'File unduhan'} data-testid="text-file-name">{job.fileName || 'File unduhan'}</div>
                                <div className="file-size" data-testid="text-file-size">{formatSize(job.fileSize)}</div>
                              </div>
                            </div>
                            <button className="download-button" type="button" data-testid="button-save-file" onClick={() => void saveFile()} disabled={fileQuery.isFetching}>
                              {fileQuery.isFetching ? <LoaderCircle size={13} className="spin-icon" /> : <ArrowDownToLine size={13} />}
                              {fileQuery.isFetching ? 'Menyiapkan file' : 'Simpan file'}
                            </button>
                          </>
                        ) : (
                          <div className="empty-copy" data-testid="text-terminal-guidance">
                            <strong>{job.status === 'blocked' ? 'Tujuan ini tidak didukung' : job.status === 'cancelled' ? 'Proses ini telah dihentikan' : 'File tidak berhasil dikirim'}</strong>
                            <p>{job.status === 'blocked' ? 'Server berhenti di tujuan yang tidak dapat diikuti dengan aman.' : job.status === 'cancelled' ? 'Kirim tautan lagi untuk memulai proses baru.' : 'Periksa langkah di atas untuk mengetahui titik proses terhenti.'}</p>
                          </div>
                        )}
                        {isActive && (
                          <button className="cancel-button" type="button" data-testid="button-cancel-download" onClick={cancelActiveJob} disabled={cancelDownload.isPending}>
                            {cancelDownload.isPending ? 'Menghentikan…' : 'Batalkan proses'}
                          </button>
                        )}
                      </div>
                    )}
                    {job.status === 'completed' && downloadError && <p className="download-error" role="alert" data-testid="text-download-error">{downloadError}</p>}
                    {isActive && (
                      <div className="job-actions">
                        <span className="field-help" data-testid="text-polling-note"><Clock3 size={13} /> Progres diperiksa otomatis setiap beberapa detik.</span>
                        <button className="cancel-button" type="button" data-testid="button-cancel-download" onClick={cancelActiveJob} disabled={cancelDownload.isPending}>
                          {cancelDownload.isPending ? 'Menghentikan…' : 'Batalkan proses'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="panel info-panel" data-testid="panel-how-it-works">
            <div className="panel-kicker">Tanpa perlu menerka-nerka</div>
            <h2 className="info-heading">Lihat prosesnya, bukan hanya hasilnya.</h2>
            <div className="info-list">
              <div className="info-item" data-testid="info-step-open">
                <span className="info-icon"><ExternalLink size={14} /></span>
                <div><strong>Pengalihan terlihat jelas</strong><p>Lihat setiap halaman yang didukung dan dibuka server.</p></div>
              </div>
              <div className="info-item" data-testid="info-step-wait">
                <span className="info-icon"><Clock3 size={14} /></span>
                <div><strong>Jeda yang dijelaskan</strong><p>Beberapa tautan perlu waktu. Anda tetap mendapat kabar.</p></div>
              </div>
              <div className="info-item" data-testid="info-step-outcome">
                <span className="info-icon"><ShieldCheck size={14} /></span>
                <div><strong>Alasan berhenti dijelaskan</strong><p>Jika tujuan diblokir atau gagal, Anda akan tahu di mana proses berakhir.</p></div>
              </div>
            </div>
          </aside>
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
