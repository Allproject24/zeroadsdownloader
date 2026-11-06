---
name: Downloader runtime timeouts
description: Prevent stalled browser actions and stale progress in the Sfile downloader.
---

Browser actions need a finite CDP protocol timeout and explicit timeout handling in addition to an overall job deadline. A single unresponsive click can otherwise occupy the job until Puppeteer's much longer default command timeout. Progress responses should bypass browser caching because a 304 response has no JSON body and can leave the UI showing an old active snapshot.

**Why:** The user reported a job stuck on a “Next” click; the job later failed at the three-minute limit, while status polling repeatedly received 304 responses.

**How to apply:** Preserve bounded browser-command timeouts, explicit click failure states, and no-cache behavior in both the API status route and the web polling request when modifying this flow.
