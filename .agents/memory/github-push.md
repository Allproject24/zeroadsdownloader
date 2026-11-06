---
name: GitHub pushes from this Repl
description: Reliable push workflow when the GitHub connector is unavailable.
---

When a user authorizes pushing, inspect the current branch and worktree, confirm the repository from the user's context, and compare the remote branch with the local commit's parent before pushing. Stop if the remote has unrelated commits. After pushing, verify the remote ref matches the intended commit.

**Why:** In this Repl, the GitHub integration reported authorization but did not provide a usable API connection. A direct HTTPS Git push to the confirmed repository succeeded through the environment's GitHub routing.

**How to apply:** Do not retry or expose credentials when the connector is unavailable. A direct push may work without embedding credentials in the URL, but only push after the repository and fast-forward state are verified.
