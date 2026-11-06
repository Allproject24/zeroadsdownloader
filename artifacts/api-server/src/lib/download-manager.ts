import { promises as dns } from "node:dns";
import { constants as fsConstants, promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import puppeteer, {
  type Browser,
  type Page,
} from "puppeteer-core";

type ClickableHandle = NonNullable<Awaited<ReturnType<Page["$"]>>>;

export type DownloadStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type DownloadStepKind =
  | "open"
  | "wait"
  | "click"
  | "redirect"
  | "download"
  | "notice";

export interface DownloadStep {
  id: number;
  kind: DownloadStepKind;
  message: string;
  url: string | null;
}

export interface DownloadJobView {
  id: string;
  status: DownloadStatus;
  message: string;
  steps: DownloadStep[];
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
}

interface DownloadJob extends DownloadJobView {
  sourceUrl: string;
  tempDir: string | null;
  filePath: string | null;
  browser: Browser | null;
  cancelRequested: boolean;
  downloadGuid: string | null;
  suggestedFilename: string | null;
  attachmentUrls: Set<string>;
}

const SUPPORTED_START_HOSTS = [
  "sfl.gl",
  "safelinku.com",
  "sfile.co",
  "sfile.mobi",
  "safefileku.com",
];
const FILE_HOSTS = ["sfile.co", "sfile.mobi", "safefileku.com"];
const MAX_ACTIVE_JOBS = 2;
const MAX_QUEUED_JOBS = 4;
const MAX_BROWSER_TABS = 12;
const MAX_OPEN_CLICKS_PER_TAB = 3;
const MAX_FLOW_TIME_MS = 2 * 60 * 1000;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const JOB_TTL_MS = 20 * 60 * 1000;
const WAIT_AFTER_CLICK_MS = 10_000;
const BROWSER_PROTOCOL_TIMEOUT_MS = 15_000;
const jobs = new Map<string, DownloadJob>();
const queuedWorkers: Array<() => void> = [];
let activeWorkers = 0;

export function isSupportedStartUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      SUPPORTED_START_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

export function getDownloadJob(id: string): DownloadJobView | undefined {
  const job = jobs.get(id);
  return job ? toView(job) : undefined;
}

export function canAcceptDownloadJob(): boolean {
  const pending = [...jobs.values()].filter(
    (job) => job.status === "queued" || job.status === "running",
  ).length;
  return pending < MAX_ACTIVE_JOBS + MAX_QUEUED_JOBS;
}

export function getDownloadFile(
  id: string,
): { path: string; fileName: string; fileSize: number } | undefined {
  const job = jobs.get(id);
  if (job?.status !== "completed" || !job.filePath || !job.fileName) {
    return undefined;
  }
  return { path: job.filePath, fileName: job.fileName, fileSize: job.fileSize ?? 0 };
}

export function startDownloadJob(sourceUrl: string): DownloadJobView {
  const job: DownloadJob = {
    id: randomUUID(),
    sourceUrl,
    status: "queued",
    message: "Menunggu browser tersedia.",
    steps: [],
    fileName: null,
    fileSize: null,
    error: null,
    tempDir: null,
    filePath: null,
    browser: null,
    cancelRequested: false,
    downloadGuid: null,
    suggestedFilename: null,
    attachmentUrls: new Set(),
  };
  jobs.set(job.id, job);
  addStep(job, "open", "Tautan diterima; menunggu browser.", sourceUrl);
  void runJob(job);
  return toView(job);
}

export async function cancelDownloadJob(id: string): Promise<DownloadJobView | undefined> {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (job.status === "completed" || job.status === "failed" || job.status === "blocked") {
    return toView(job);
  }
  job.cancelRequested = true;
  job.status = "cancelled";
  job.message = "Unduhan dibatalkan.";
  addStep(job, "notice", job.message, null);
  await job.browser?.close().catch(() => undefined);
  scheduleCleanup(job);
  return toView(job);
}

function toView(job: DownloadJob): DownloadJobView {
  return {
    id: job.id,
    status: job.status,
    message: job.message,
    steps: job.steps.map((step) => ({ ...step })),
    fileName: job.fileName,
    fileSize: job.fileSize,
    error: job.error,
  };
}

function isTerminalStatus(status: DownloadStatus): boolean {
  return status === "completed" || status === "blocked" || status === "failed" || status === "cancelled";
}

function addStep(
  job: DownloadJob,
  kind: DownloadStepKind,
  message: string,
  url: string | null,
): void {
  job.steps.push({
    id: job.steps.length + 1,
    kind,
    message,
    url: url ? safeDisplayUrl(url) : null,
  });
  job.message = message;
}

function safeDisplayUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return "";
  }
}

function sanitizeFilename(value: string): string {
  const name = path
    .basename(value.replace(/\\/g, "/"))
    .replace(/[\x00-\x1f<>:"|?*]/g, "_")
    .trim()
    .replace(/^\.+$/, "");
  return (name || "download.bin").slice(0, 150);
}

function hostMatches(host: string, domains: string[]): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function isPublicAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0 || b === 2)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && octets[2] === 113) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("::ffff:")
    ) {
      return false;
    }
    const firstGroup = Number.parseInt(normalized.split(":")[0] || "0", 16);
    return firstGroup >= 0x2000 && firstGroup <= 0x3fff;
  }
  return false;
}

async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }
  if (net.isIP(host)) return isPublicAddress(host);
  try {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicAddress(address));
  } catch {
    return false;
  }
}

async function acquireWorker(): Promise<void> {
  if (activeWorkers < MAX_ACTIVE_JOBS) {
    activeWorkers += 1;
    return;
  }
  await new Promise<void>((resolve) => queuedWorkers.push(resolve));
}

function releaseWorker(): void {
  const next = queuedWorkers.shift();
  if (next) {
    next();
  } else {
    activeWorkers = Math.max(0, activeWorkers - 1);
  }
}

async function runJob(job: DownloadJob): Promise<void> {
  await acquireWorker();
  if (job.cancelRequested) {
    releaseWorker();
    return;
  }
  job.status = "running";
  job.message = "Membuka halaman perantara di browser.";

  try {
    const executablePath =
      process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
    await fs.access(executablePath, fsConstants.X_OK);
    job.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sfile-download-"));
    job.browser = await puppeteer.launch({
      executablePath,
      headless: true,
      protocolTimeout: BROWSER_PROTOCOL_TIMEOUT_MS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
      ],
    });
    await runBrowserFlow(job);
  } catch (error) {
    if (!job.cancelRequested && !isTerminalStatus(job.status)) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Browser gagal menjalankan tautan.";
      job.message = job.error;
      addStep(job, "notice", job.error, null);
    }
  } finally {
    await job.browser?.close().catch(() => undefined);
    job.browser = null;
    releaseWorker();
    if (isTerminalStatus(job.status)) scheduleCleanup(job);
  }
}

async function runBrowserFlow(job: DownloadJob): Promise<void> {
  const browser = job.browser;
  const tempDir = job.tempDir;
  if (!browser || !tempDir) throw new Error("Browser belum siap.");

  const browserSession = await browser.target().createCDPSession();
  await browserSession.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: tempDir,
    eventsEnabled: true,
  });

  browserSession.on(
    "Browser.downloadWillBegin",
    (event: { guid: string; url: string; suggestedFilename: string }) => {
      if (job.status !== "running" || job.cancelRequested) return;
      const fileHost = (() => {
        try {
          return new URL(event.url).hostname;
        } catch {
          return "";
        }
      })();
      const isFileHost = hostMatches(fileHost, FILE_HOSTS);
      const hasAttachmentHeader = job.attachmentUrls.has(event.url);
      if (!isFileHost && !hasAttachmentHeader) {
        addStep(job, "notice", "Mengabaikan unduhan yang bukan dari halaman file.", event.url);
        void browserSession.send("Browser.cancelDownload", { guid: event.guid }).catch(() => undefined);
        return;
      }
      job.downloadGuid = event.guid;
      job.suggestedFilename = sanitizeFilename(event.suggestedFilename);
      addStep(job, "download", "File terdeteksi; sedang disiapkan.", event.url);
    },
  );
  browserSession.on(
    "Browser.downloadProgress",
    (event: {
      guid: string;
      state: string;
      filePath?: string;
      receivedBytes?: number;
      totalBytes?: number;
    }) => {
      if (event.guid !== job.downloadGuid) return;
      if (
        (event.receivedBytes ?? 0) > MAX_FILE_BYTES ||
        (event.totalBytes ?? 0) > MAX_FILE_BYTES
      ) {
        job.status = "failed";
        job.error = "File melebihi batas ukuran 500 MB.";
        job.message = job.error;
        addStep(job, "notice", job.error, null);
        void browserSession.send("Browser.cancelDownload", { guid: event.guid }).catch(() => undefined);
        return;
      }
      if (event.state === "canceled") {
        job.status = "failed";
        job.error = "Server membatalkan pengiriman file.";
        job.message = job.error;
        addStep(job, "notice", job.error, null);
        return;
      }
      if (event.state === "completed") {
        void finishDownloadedFile(job, event.filePath);
      }
    },
  );

  const page = await browser.newPage();
  const knownPages = new WeakSet<Page>();
  const pendingPages: Page[] = [page];
  const queuedPages = new WeakSet<Page>();
  queuedPages.add(page);
  const attemptsByPage = new WeakMap<Page, number>();
  let uniqueTabs = 0;
  const startedAt = Date.now();

  const attachPage = async (target: Page): Promise<void> => {
    if (knownPages.has(target)) return;
    knownPages.add(target);
    uniqueTabs += 1;
    target.setDefaultNavigationTimeout(25_000);
    target.setDefaultTimeout(8_000);

    const hostCache = new Map<string, Promise<boolean>>();
    await target.setRequestInterception(true);
    target.on("request", (request) => {
      void (async () => {
        const rawUrl = request.url();
        if (/^(data|blob|about):/i.test(rawUrl)) {
          await request.continue();
          return;
        }
        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          await request.abort("blockedbyclient");
          return;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          await request.abort("blockedbyclient");
          return;
        }
        let check = hostCache.get(parsed.hostname);
        if (!check) {
          check = isPublicHost(parsed.hostname);
          hostCache.set(parsed.hostname, check);
        }
        if (!(await check)) {
          addStep(job, "notice", "Permintaan ke alamat jaringan privat diblokir.", rawUrl);
          await request.abort("blockedbyclient");
          return;
        }
        await request.continue();
      })().catch(() => request.abort("blockedbyclient").catch(() => undefined));
    });

    target.on("response", (response) => {
      const disposition = response.headers()["content-disposition"] ?? "";
      if (response.status() >= 200 && response.status() < 300 && /attachment/i.test(disposition)) {
        job.attachmentUrls.add(response.url());
      }
    });

    target.on("framenavigated", (frame) => {
      if (frame !== target.mainFrame()) return;
      const url = frame.url();
      if (url && url !== "about:blank") {
        addStep(job, "redirect", "Halaman berpindah ke langkah berikutnya.", url);
      }
    });
    target.on("popup", (popup) => {
      if (!popup) return;
      void attachPage(popup).then(() => {
        if (!queuedPages.has(popup)) {
          queuedPages.add(popup);
          pendingPages.push(popup);
        }
      });
    });
  };

  await attachPage(page);
  addStep(job, "open", "Membuka tautan di browser.", job.sourceUrl);
  try {
    await page.goto(job.sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch {
    if (page.url() === "about:blank") throw new Error("Halaman tautan tidak dapat dibuka.");
    addStep(job, "notice", "Halaman membutuhkan waktu lebih lama; melanjutkan pemeriksaan.", page.url());
  }

  while (
    pendingPages.length > 0 &&
    uniqueTabs <= MAX_BROWSER_TABS &&
    Date.now() - startedAt < MAX_FLOW_TIME_MS &&
    job.status === "running" &&
    !job.cancelRequested
  ) {
    const current = pendingPages.shift();
    if (!current || current.isClosed()) continue;
    queuedPages.delete(current);

    await waitWhileRunning(job, 1_200);
    if (job.status !== "running" || current.isClosed()) break;

    const currentUrl = current.url();
    const text = await current
      .evaluate(() => `${document.title}\n${document.body?.innerText ?? ""}`)
      .catch(() => "");
    if (isHumanVerification(text, currentUrl)) {
      job.status = "blocked";
      job.error = "Situs meminta verifikasi manusia; proses tidak melewati CAPTCHA.";
      job.message = job.error;
      addStep(job, "notice", job.error, currentUrl);
      break;
    }

    const action = await findAction(current);
    if (!action) continue;
    const attempts = attemptsByPage.get(current) ?? 0;
    if (attempts >= MAX_OPEN_CLICKS_PER_TAB) continue;
    attemptsByPage.set(current, attempts + 1);

    addStep(
      job,
      "click",
      `Membuka tombol “${action.label}” di tab latar (${attempts + 1}/${MAX_OPEN_CLICKS_PER_TAB}).`,
      currentUrl,
    );
    const priorUrl = current.url();
    try {
      await action.handle.click({ delay: 40 });
    } catch (error) {
      const errorText =
        error instanceof Error ? `${error.name} ${error.message}` : String(error);
      if (/timeout|timed out/i.test(errorText)) {
        job.status = "failed";
        job.error = `Halaman tidak merespons saat tombol “${action.label}” diklik. Proses dihentikan setelah 15 detik.`;
        job.message = job.error;
        addStep(job, "notice", job.error, currentUrl);
        break;
      }
      addStep(
        job,
        "notice",
        `Klik tombol “${action.label}” tidak terkonfirmasi; memeriksa tab yang terbuka.`,
        currentUrl,
      );
    }
    addStep(
      job,
      "wait",
      "Menunggu 10 detik sebelum melanjutkan alur.",
      current.url(),
    );
    await waitWhileRunning(job, WAIT_AFTER_CLICK_MS);
    if (job.status !== "running" || job.cancelRequested) break;

    const allPages = await browser.pages();
    for (const newPage of allPages) {
      if (!knownPages.has(newPage)) await attachPage(newPage);
      if (!queuedPages.has(newPage)) {
        queuedPages.add(newPage);
        pendingPages.push(newPage);
      }
    }

    if (current.url() !== priorUrl && !current.isClosed()) {
      addStep(job, "redirect", "Kembali ke halaman sebelumnya untuk mencoba langkah berikutnya.", current.url());
      await current.goBack({ waitUntil: "domcontentloaded", timeout: 12_000 }).catch(() => undefined);
      await waitWhileRunning(job, 500);
    }

    if (
      attempts + 1 < MAX_OPEN_CLICKS_PER_TAB &&
      !current.isClosed() &&
      (await findAction(current))
    ) {
      if (!queuedPages.has(current)) {
        queuedPages.add(current);
        pendingPages.push(current);
      }
    }
  }

  if (job.status === "running" && !job.cancelRequested) {
    if (job.downloadGuid) {
      const downloadWaitEnds = Date.now() + 30_000;
      while (job.status === "running" && Date.now() < downloadWaitEnds) {
        await waitWhileRunning(job, 300);
      }
    }
    if (Date.now() - startedAt >= MAX_FLOW_TIME_MS) {
      job.error = "Alur melewati batas waktu dua menit.";
    } else if (uniqueTabs > MAX_BROWSER_TABS) {
      job.error = "Alur membuka terlalu banyak tab; proses dihentikan.";
    } else if (!job.filePath) {
      job.error = "Tidak ditemukan respons file unduhan yang didukung.";
    }
    if (job.error) {
      job.status = "failed";
      job.message = job.error;
      addStep(job, "notice", job.error, null);
    }
  }

  await browserSession.detach().catch(() => undefined);
}

async function findAction(
  page: Page,
): Promise<{ handle: ClickableHandle; label: string } | null> {
  const controls = await page.$$("button, a, input[type=submit], [role=button]").catch(() => []);
  const candidates: Array<{
    handle: (typeof controls)[number];
    label: string;
    score: number;
  }> = [];

  for (const handle of controls) {
    const details = await handle
      .evaluate((element) => {
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const style = window.getComputedStyle(htmlElement);
        const label =
          htmlElement.innerText ||
          (htmlElement as HTMLInputElement).value ||
          htmlElement.getAttribute("aria-label") ||
          "";
        return {
          label: label.trim().replace(/\s+/g, " ").slice(0, 80),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            !htmlElement.hasAttribute("disabled"),
          tag: htmlElement.tagName.toLowerCase(),
          className: htmlElement.className.toString(),
          href: (htmlElement as HTMLAnchorElement).href || "",
        };
      })
      .catch(() => null);
    if (!details?.visible || !details.label) continue;
    const label = details.label;
    const normalized = label.toLowerCase();
    let score = 0;
    if (normalized === "open") score = 100;
    else if (/^(get\s*link|continue|proceed|next|lanjut|buka\s*link)$/i.test(normalized)) score = 80;
    else if (/^(download|unduh|download\s*now|unduh\s*sekarang)$/i.test(normalized)) score = 90;
    if (!score) continue;
    if (details.tag === "button") score += 10;
    if (/slbtn/i.test(details.className)) score += 30;
    if (details.href) {
      try {
        if (hostMatches(new URL(details.href).hostname, [...FILE_HOSTS, "sfl.gl", "safelinku.com"])) {
          score += 20;
        }
      } catch {
        // Ignore malformed links and keep the text-based score.
      }
    }
    candidates.push({ handle, label, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return top ? { handle: top.handle, label: top.label } : null;
}

function isHumanVerification(text: string, url: string): boolean {
  return (
    /just a moment|verify (?:that )?you are human|checking your browser|complete the security check|cf-chl-/i.test(
      `${text}\n${url}`,
    ) ||
    /\/cdn-cgi\/challenge-platform\//i.test(url)
  );
}

async function waitWhileRunning(job: DownloadJob, durationMs: number): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end && job.status === "running" && !job.cancelRequested) {
    await sleep(Math.min(400, end - Date.now()));
  }
}

async function finishDownloadedFile(job: DownloadJob, browserPath?: string): Promise<void> {
  if (!job.tempDir || job.status !== "running") return;
  const expected = browserPath
    ? path.resolve(browserPath)
    : path.join(job.tempDir, job.suggestedFilename || "download.bin");
  let candidate = expected;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile() && !candidate.endsWith(".crdownload")) {
        if (stat.size > MAX_FILE_BYTES) {
          await fs.rm(candidate, { force: true });
          job.status = "failed";
          job.error = "File melebihi batas ukuran 500 MB.";
          job.message = job.error;
          addStep(job, "notice", job.error, null);
          return;
        }
        job.filePath = candidate;
        job.fileName = sanitizeFilename(path.basename(candidate));
        job.fileSize = stat.size;
        job.status = "completed";
        job.message = "File siap diunduh.";
        addStep(job, "download", job.message, null);
        return;
      }
    } catch {
      const entries = await fs.readdir(job.tempDir).catch(() => []);
      const completed = entries.find(
        (entry) => !entry.endsWith(".crdownload") && !entry.endsWith(".tmp"),
      );
      if (completed) candidate = path.join(job.tempDir, completed);
    }
    await sleep(250);
  }
  job.status = "failed";
  job.error = "File selesai dari browser tetapi tidak ditemukan di penyimpanan sementara.";
  job.message = job.error;
  addStep(job, "notice", job.error, null);
}

function scheduleCleanup(job: DownloadJob): void {
  const timer = setTimeout(() => {
    void (async () => {
      await fs.rm(job.tempDir ?? "", { recursive: true, force: true }).catch(() => undefined);
      jobs.delete(job.id);
    })();
  }, JOB_TTL_MS);
  timer.unref();
}
