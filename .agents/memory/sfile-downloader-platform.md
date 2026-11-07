---
name: Sfile downloader platform
description: Product requirement for how the Sfile download flow should work.
---

The Sfile downloader should handle the link flow directly in the website. Do not require 1DM or another external download manager.

**Why:** The user explicitly prefers downloading directly from the website rather than switching to a separate app.

**How to apply:** Keep link-following, progress, and file delivery inside the web app unless the user changes this requirement.

During an active download, show a simple loading state instead of exposing every redirect, button click, and wait step. Keep the final outcome and any manual-verification guidance visible.

**Why:** The user asked for a cleaner, more professional interface and said detailed process steps are unnecessary.

**How to apply:** Hide the step timeline while processing; preserve clear completion, failure, cancellation, and Safefileku handoff states.

Keep interface copy brief and neutral; avoid promotional or exaggerated wording and redundant status explanations.

**Why:** The user said the earlier presentation felt too busy and the wording too overblown compared with their reference.

**How to apply:** Prefer a short page title, one direct input label, a simple action label, and concise result text.

Keep the exact product name “ZeroAds Downloader”; do not rename the page or footer to “Malz Bypass URL” or another name unless the user asks.

**Why:** The user explicitly requested ZeroAds Downloader and corrected a regression where the visible page title and footer had changed.

**How to apply:** Preserve ZeroAds Downloader in the page title, browser metadata, and footer. Treat screenshot references as visual guidance, not permission to change the product name. Keep the feature chips visible during processing, show one spinner and an elapsed-seconds timer in the primary button, hide cancellation controls, and present only real file or validated Safefileku URL results.

Before continuing feature development, keep GitHub repository readiness, Vercel deployment compatibility, and clear feature boundaries as project requirements.

**Why:** The user asked to pause feature work until the site can run from GitHub and on Vercel, with features separated into focused files.

**How to apply:** Assess the existing Express, Puppeteer/Chromium, job-duration, and temporary-file requirements before choosing a Vercel architecture. Keep shared orchestration separate from each provider's flow; do not let one file accumulate unrelated features.

The user said the current appearance is final and deployment work must not change it.

**Why:** The user explicitly asked that no further visual changes be made.

**How to apply:** Limit this work to code organization and deployment configuration; preserve visible copy, layout, colors, and interactions unless the user asks otherwise.

The automated link flow must stop as soon as it observes a validated official Safefileku `/download/<id>` URL. Show that URL for the user to open and verify in their own browser; do not automate the human check or click Download after the URL is found.

**Why:** The user clarified that ZeroAds Downloader should only handle the short-link/ad stages and hand off at the original URL for manual verification.

**How to apply:** Treat a validated Safefileku URL as the terminal handoff state, even when no verification challenge has appeared yet.

The source repository is GitHub and the production deployment is Vercel; Replit preview is not the live site.

**Why:** The user explicitly corrected the deployment context.

**How to apply:** Verify Vercel-compatible builds and distinguish local checks from production success; do not claim a Vercel deploy unless it is actually confirmed.

For production debugging, do not guess missing URLs, branches, or deployment behavior. First confirm the change is in the configured GitHub production branch and that Vercel has deployed that commit; only then test the live deployment. Replit preview is not a substitute for Vercel verification.

**Why:** The user corrected the sequence after being asked for a Vercel URL before the change had reached GitHub; the Replit preview was already known to work and was not the target.

**How to apply:** Verify the repository and production branch, get the intended commit deployed to Vercel, then use deployment evidence and live behavior to diagnose production. Do not ask for a live URL before confirming the deployment is current.
