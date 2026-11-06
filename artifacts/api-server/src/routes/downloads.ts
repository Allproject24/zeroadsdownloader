import {
  CancelDownloadParams,
  CancelDownloadResponse,
  GetDownloadParams,
  GetDownloadResponse,
  GetDownloadedFileParams,
  StartDownloadBody,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import {
  canStartSynchronousDownload,
  canAcceptDownloadJob,
  cancelDownloadJob,
  getDownloadFile,
  getDownloadJob,
  isSupportedStartUrl,
  processDownloadSynchronously,
} from "../lib/download-manager";

const router: IRouter = Router();

router.post("/downloads", async (req, res): Promise<void> => {
  const parsed = StartDownloadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isSupportedStartUrl(parsed.data.url)) {
    res.status(400).json({
      error:
        "URL tidak didukung. Gunakan tautan sfl.gl, safelinku.com, sfile.co, sfile.mobi, atau safefileku.com.",
    });
    return;
  }
  if (!canAcceptDownloadJob()) {
    res.status(429).json({ error: "Antrean unduhan penuh. Coba lagi beberapa menit lagi." });
    return;
  }
  if (!canStartSynchronousDownload()) {
    res.status(429).json({ error: "Unduhan lain sedang diproses. Coba lagi sebentar." });
    return;
  }

  try {
    const { job, file } = await processDownloadSynchronously(parsed.data.url);
    if (file) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Download-Result", "file");
      res.setHeader("X-Download-Id", job.id);
      res.setHeader("X-Download-File-Name", encodeURIComponent(file.fileName));
      res.setHeader("X-Download-File-Size", String(file.fileSize));
      res.download(file.path, file.fileName, (error) => {
        if (error) {
          req.log.error({ err: error, jobId: job.id }, "Download response failed");
        }
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(job);
  } catch (error) {
    req.log.error({ err: error }, "Synchronous download failed");
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unduhan tidak dapat diproses.",
    });
  }
});

router.get("/downloads/:jobId", (req, res): void => {
  const params = GetDownloadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const job = getDownloadJob(params.data.jobId);
  if (!job) {
    res.status(404).json({ error: "Unduhan tidak ditemukan atau sudah kedaluwarsa." });
    return;
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(GetDownloadResponse.parse(job));
});

router.post("/downloads/:jobId/cancel", async (req, res): Promise<void> => {
  const params = CancelDownloadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const job = await cancelDownloadJob(params.data.jobId);
  if (!job) {
    res.status(404).json({ error: "Unduhan tidak ditemukan atau sudah kedaluwarsa." });
    return;
  }
  res.json(CancelDownloadResponse.parse(job));
});

router.get("/downloads/:jobId/file", async (req, res): Promise<void> => {
  const params = GetDownloadedFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const job = getDownloadJob(params.data.jobId);
  if (!job) {
    res.status(404).json({ error: "Unduhan tidak ditemukan atau sudah kedaluwarsa." });
    return;
  }
  const file = getDownloadFile(params.data.jobId);
  if (!file) {
    res.status(409).json({ error: "File belum selesai disiapkan." });
    return;
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Length", String(file.fileSize));
  res.download(file.path, file.fileName, (error) => {
    if (error) {
      req.log.error({ err: error, jobId: params.data.jobId }, "Download response failed");
    }
  });
});

export default router;
