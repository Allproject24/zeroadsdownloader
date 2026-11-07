# ZeroAds Downloader

ZeroAds Downloader processes supported short links and returns the resulting file in the browser. The current interface is kept unchanged; downloader code is organized under `artifacts/sfile-web-downloader/src/features/downloader/`.

## Requirements

- Node.js 24
- pnpm 10

## Recommended free hosting: Northflank

The downloader uses a real headless Chromium browser, temporary disk, and a request that can stay open while the link is processed. A single Docker service keeps the browser, temporary file, API response, and website together in one runtime.

Northflank's Sandbox currently offers a no-card free plan with always-on services and up to $20/month of included cloud resources. Keep the account on Sandbox and monitor its usage; higher usage or a paid plan can cost money. The free plan has limited compute, so this setup is intended for light use.

1. Push this repository and the desired production branch to GitHub.
2. In Northflank, create a **Combined service** from that GitHub repository and branch.
3. Select **Dockerfile** with the repository root as the build context and Dockerfile path.
4. Expose port `7860` publicly over HTTP. Keep the service on the free Sandbox resource allocation (start with `nf-compute-50`, 0.5 vCPU and 1 GB RAM). If an ingress request-timeout setting is available, allow at least 240 seconds for `/api/downloads`.
5. Deploy and open the service URL. Check `GET /api/healthz` for the API health response.

The container builds both the Vite site and Express API, serves them from the same origin, and uses the bundled Chromium package. No database or API key is required. Downloaded files remain temporary and are streamed to the visitor; they are not saved as durable server data.

If a short-link host presents Cloudflare or human verification, the app stops rather than trying to defeat it. A different hosting provider may behave differently, but cannot guarantee that the link host will allow automated navigation.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository.
3. Leave the project root directory as `.` and choose **Import multi-service project**.
4. Keep the service, install, build, output, and routing settings from `vercel.json`. The `web` and `api` services share one domain; do not import `artifacts/sfile-web-downloader` by itself because the downloader also needs `/api`.
5. Deploy. No API key or separate Chromium download is needed; the Vercel function uses the packaged Chromium runtime.

The build writes the web app to `artifacts/sfile-web-downloader/dist/public/` and splits the downloader feature and shared runtime into separate JavaScript chunks. The Express API is exposed from `src/index.ts` and receives requests under `/api`.

Each download runs inside one Vercel Function request. The browser flow has a two-minute limit, and Vercel's function timeout is configured to 300 seconds. To leave room for Chromium in Vercel's temporary disk, downloads are limited to 250 MB there (500 MB on the Docker service).

The API currently limits concurrent work per function instance. Vercel can run multiple instances, so add shared rate limiting before opening the endpoint to high public traffic. The Vercel configuration remains available, but the function's outbound browser requests can still be challenged by short-link hosts.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/sfile-web-downloader run build:vercel
```
