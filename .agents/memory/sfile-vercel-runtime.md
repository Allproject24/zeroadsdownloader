---
name: Vercel downloader runtime
description: Behavior differences between the Replit preview and Vercel runtime for short-link processing.
---

Replit and Vercel use different Chromium builds and network egress. A Vercel download request can return HTTP 200 with a `blocked` job when Cloudflare presents a challenge at the initial short-link host; this is an application-level stop, not a failed deployment. A `Just a moment...` page title alone indicates an interstitial, not proof that a human check appeared. If the browser is still at `sfl.gl` and no official `safefileku.com/download/<id>` URL was observed, there is no validated direct destination URL for the UI to show.

**Why:** Production requests to the user's Vercel app stayed on `sfl.gl` with title `Just a moment...`, a Cloudflare widget, and `manualUrl: null`; one remained there after a 15-second passive wait and returned in 20.5 seconds. A previous sample also persisted through a 12-second wait.

**How to apply:** Compare the blocked job's last observed host and title, not only Vercel build status or function logs. Allow one bounded passive wait for a transient interstitial to redirect; if it persists, stop and report the observed state. Do not repeatedly extend waits or interact with Cloudflare; if the official destination was never observed, do not claim the final link is available.
