# ZeroAds Downloader

ZeroAds Downloader processes supported short links and returns the resulting file in the browser. The current interface is kept unchanged; downloader code is organized under `artifacts/sfile-web-downloader/src/features/downloader/`.

## Requirements

- Node.js 24
- pnpm 10

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository.
3. Leave the project root directory as `.` so Vercel can read the workspace and both apps.
4. Keep the install, build, and output settings from `vercel.json`.
5. Deploy. No API key or separate Chromium download is needed; the Vercel function uses the packaged Chromium runtime.

The build writes the web app to `public/` and splits the downloader feature and shared runtime into separate JavaScript chunks. The Express API is exposed from `src/index.ts` in the same Vercel project.

Each download runs inside one Vercel Function request. The browser flow has a two-minute limit, and Vercel's function timeout is configured to 300 seconds. To leave room for Chromium in Vercel's temporary disk, downloads are limited to 250 MB there (500 MB in the Replit runtime).

The API currently limits concurrent work per function instance. Vercel can run multiple instances, so add shared rate limiting before opening the endpoint to high public traffic.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/sfile-web-downloader run build:vercel
```
