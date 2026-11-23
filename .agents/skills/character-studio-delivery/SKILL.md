---
name: character-studio-delivery
description: Complete requested changes in the character-studio project, validate them, then commit and push to its existing GitHub repository. Apply to project edits, not read-only questions.
---

# Character Studio delivery

## Project and standing authorization

This skill applies only to the Character Studio project whose Git origin is https://github.com/a01089501562-lang/character-studio.git. The repository is normally the character-studio subdirectory of the user's 기말과제 workspace.

The user explicitly requested on 2026-11-23 that future project work follow this sequence: implement the request, commit to GitHub, and push. Treat commit and push as part of completing authorized edits; do not ask for routine confirmation again. A later request such as “로컬만”, “커밋하지 마”, or “푸시하지 마” overrides this default for the requested scope. Read-only discussion does not create a commit.

## Delivery workflow

1. Locate the repository and read its AGENTS.md. Inspect git status, the current branch, and origin before editing. Preserve unrelated local changes. The established delivery branch is main; do not silently switch branches or change the remote. If working on an intentionally selected branch, retain that branch and its upstream.
2. Implement the requested changes completely. Preserve existing lesson, drawing, storage, and submission behavior unless the request changes them. This is a buildless HTML/CSS/JavaScript site; no package installation or framework migration is required for ordinary edits.
3. Validate in proportion to the change: inspect the diff, run git diff --check, and check JavaScript syntax when a runtime is available. For visual changes, inspect desktop and narrow layouts when browser preview is available. Never submit real student work merely to test a design change. Report unavailable verification honestly.
4. Fetch the existing remote before delivery. Review and stage only the files belonging to the task, including requested project instructions or skills. Do not stage reference images, local backups, browser profiles, credentials, or unrelated work by using an indiscriminate git add. Commit with a concise message describing the final change. Do not create empty commits when nothing changed.
5. Push the commit to the existing origin and intended branch, normally git push origin main. Check successful push output and verify the remote branch SHA matches the delivered local commit. Inspect the remaining working-tree changes without discarding them.
6. Reply briefly in Korean with the result, commit link or short SHA, and any real validation limits. Distinguish commit/push completion from website deployment; do not claim deployment without checking it.

## Failure handling

Never force-push, reset away user changes, or overwrite remote work. If the remote moved, inspect the divergence and integrate non-destructively when the resolution is clear, then revalidate and retry a normal push. Stop dependent delivery steps when unresolved conflicts, failed checks, authentication, or branch protection block them; retain the work and explain the exact blocker and whether a local commit already exists. Do not repeat the same failed attempt without new information. Respect native tool approval requirements.
