---
name: Vercel downloader runtime
description: Behavior differences between the Replit preview and Vercel runtime for short-link processing.
---

Replit and Vercel use different Chromium builds and network egress. A Vercel download request can return HTTP 200 with a `blocked` job when Cloudflare challenges the initial short-link host; this is an application-level stop, not a failed deployment. If the browser is challenged at `sfl.gl` before reaching an official `safefileku.com/download/<id>` URL, there is no validated direct destination URL for the UI to show.

**Why:** A production request to the same sample link stayed on `sfl.gl` through a 12-second passive wait and then blocked, while the Replit preview had reached Safefileku.

**How to apply:** Compare the blocked job's last observed host, not only Vercel build status or function logs. Do not keep extending timeouts for a persistent challenge or click/solve Cloudflare; if the official destination was never observed, do not claim the final link is available.
