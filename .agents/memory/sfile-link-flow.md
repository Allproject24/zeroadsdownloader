---
name: Sfile short-link flow
description: User-described redirect and button sequence for the Sfile short link.
---

The website's goal is to pass the ad and short-link steps, not to bypass human verification. The observed route is `sfl.gl` → `app.khaddavi.net`: click Open and wait 10 seconds, click Next, scroll to and click the next Open, then continue on the second `app.khaddavi.net` article (which may open in a new tab), wait 3 seconds after Continue, and click Go to link. Continue through `sfl.gl/ready/go` until an official Safefileku `/download/<id>` URL is observed. Stop automation at that URL and show it for the user to open; do not wait for the file countdown or click Download. The user handles any human verification that appears after opening the original destination, then proceeds with the final download. Unrelated external ad tabs stay passive; same-site article tabs remain part of the download flow. The destination article can vary between visits, and a button transition may appear about one second after the stated wait, so rescan briefly before declaring the page unsupported. Capture validated Safefileku URLs and inspect flow frames so a destination observed in a nested frame is not hidden from the user.

**Why:** The user explicitly clarified that the website only handles the short-link/ad stages and hands off as soon as the original URL appears; verification and download are user-managed at the destination. Their successful Replit run showed the complete Open → Next → Open → Continue → Go to Link → Safefileku URL flow, with unrelated ad tabs opened in the background.

**How to apply:** Use this route and timing when changing Sfile link-following behavior. Keep the two stages distinct: diagnose a Vercel failure at `sfl.gl` as an entry/short-link runtime issue, not as a request to bypass verification on the final file page. A generic “page moved” log only confirms a browser navigation; do not call it a successful flow transition unless the next expected host/page is actually observed. The displayed URL omits query and fragment data, so compare the observed host and page title too. Poll briefly for delayed controls before the official destination is reached. Once a validated `/download/<id>` URL appears, stop immediately and hand it to the user; do not operate the final human-verification or download steps.

A local run using the same `sfl.gl/EMu3rP` input returned different Khaddavi article pages. One reached the validated Safefileku URL; later runs stayed on an “Open” control after the 10-second wait and 15-second discovery window, with no destination URL observed.

**Why:** The live page variant can change between requests, and a successful local run does not prove every article variant advances or that Vercel behaves the same way.

**How to apply:** Treat a repeated “Open” control with no next action as an observed stop condition. Log the host, title, HTTP response, and visible controls; do not repeatedly click or infer a destination URL.
