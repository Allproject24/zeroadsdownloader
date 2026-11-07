---
name: Sfile short-link flow
description: User-described redirect and button sequence for the Sfile short link.
---

The expected route is `sfl.gl` → `app.khaddavi.net`: click Open and wait 10 seconds, click Next, scroll to and click the next Open, then continue on the second `app.khaddavi.net` article (which may open in a new tab), wait 3 seconds after Continue, and click Go to link. Continue through `sfl.gl/ready/go` until an official Safefileku `/download/<id>` URL is observed. Stop automation at that URL and show it for the user to open; do not wait for the file countdown or click Download. Unrelated external ad tabs stay passive; same-site article tabs remain part of the download flow. The destination article can vary between visits, and a button transition may appear about one second after the stated wait, so rescan briefly before declaring the page unsupported. Capture validated Safefileku URLs and inspect human-verification state across flow frames; otherwise a URL observed in a nested frame can remain hidden when the job fails. Keep verification and the final download manual.

**Why:** The user clarified that the website only handles the short-link/ad stages and hands off as soon as the original URL appears; they verify and download in their own browser. Navigation capture includes child frames, but top-level-only challenge checks can otherwise suppress a nested-frame destination.

**How to apply:** Use this route and timing when changing Sfile link-following behavior. Poll briefly for delayed controls before the official destination is reached. Once a validated `/download/<id>` URL appears, stop immediately and hand it to the user; never auto-click the file download or attempt human verification.
