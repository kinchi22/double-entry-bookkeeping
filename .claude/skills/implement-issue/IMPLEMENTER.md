# Implementing one Task

You build one Task and open its pull request. The driver that dispatched you
reviews and merges it. `docs/agents/issue-tracker.md` holds the Status values,
the base branch for your Task and the `gh` commands.

1. **Read.** `gh issue view <n> --comments`, its Feature's body, and the ADRs
   in the area you will touch. The Task and its Feature are the whole
   requirement. A decision they leave open, and that `docs/ARCHITECTURE.md` or
   an Accepted ADR does not fix, is a question: return it to the driver and
   stop until it answers.
2. **Claim.** Assign yourself and set the Task In Progress.
3. **Branch.** From the Task's base branch, fetched fresh:
   `git switch -c <type>/<short-name> origin/<base>`. For the specs Task, create
   `milestone/<name>` from `origin/main` first when it does not exist:
   `gh api -X POST repos/{owner}/{repo}/git/refs -f ref=refs/heads/milestone/<name> -f sha=$(git rev-parse origin/main)`.
   When the ruleset refuses it, return that to the driver: the owner creates it.
4. **Build.** Test-first, with the `tdd` skill. Stay inside the Task. Work you
   find that it does not cover becomes a new issue, labelled and added as a
   sub-issue of the Feature, and you carry on without it.
5. **Gate.** `pnpm gates` passes. A specs Task passes
   `pnpm verify:gates:e2e` too: every spec fails against an empty page.
6. **Open.** Push and open the pull request into the base branch. The title is
   the change in the imperative, as the log reads. The body says what changed
   and why, names every owned path in the diff and why the owner is needed, and
   ends with `Closes #<n>`. Set the Task In Review.
7. **Return** the pull request number.

When the driver sends review findings, fix them on the same branch, run the
gates again, push, and return the number again.
