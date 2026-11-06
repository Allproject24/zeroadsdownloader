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

Use the user's chosen home-page direction: one centered rounded card, brand mark, short title, link field, primary button, and compact supported-domain tags on a near-black background with red accents.

**Why:** The user explicitly asked to match their reference screenshot with a red-black theme.

**How to apply:** Keep the visual hierarchy close to that single-card layout; do not add extra sections or prominent promotional copy.
