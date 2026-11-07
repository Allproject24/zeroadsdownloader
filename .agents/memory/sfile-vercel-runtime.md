---
name: Vercel downloader runtime
description: Behavior differences between the Replit preview and Vercel runtime for short-link processing.
---

Replit and Vercel use different Chromium builds and network egress. A Vercel download request can return HTTP 200 with a `blocked` job when Cloudflare challenges the initial short-link host; this is an application-level stop, not a failed deployment. If the browser is challenged at `sfl.gl` before reaching an official `safefileku.com/download/<id>` URL, there is no validated direct destination URL for the UI to show.

**Why:** A production request to the same sample link stayed on `sfl.gl` through the Cloudflare challenge while the Replit preview reached Safefileku.

**How to apply:** Compare the blocked job's last observed host, not only Vercel build status or function logs. Do not solve or skip Cloudflare; when the official destination was never observed, offer only a clearly labeled way to continue the original link manually.
