# Issue tracker: GitHub Issues and Project #2

The work is tracked in this repository's GitHub Issues and on the project
[Double-Entry Bookkeeping Roadmap](https://github.com/users/kinchi22/projects/2).
They are the durable state: requirements, decisions and progress are written
there, so a session with no memory of an earlier one can pick the work up. Work
found along the way that is not the current Task becomes an issue of its own.

## Work items

| Item    | Label          | What it is |
| ------- | -------------- | ---------- |
| Feature | `type:feature` | One acceptance criterion, so one milestone branch (`docs/ARCHITECTURE.md`, "How a criterion ships"). Its body is the spec. Closed by the `milestone/<name> -> main` pull request. |
| Task    | `type:task`    | A sub-issue of a Feature, sized to one session: one Task, one branch, one pull request. A Task that needs more than one session is split before it starts. |
| Bug     | `type:bug`     | A defect. Worked like a Task, and with no Feature above it, its pull request goes to `main`. |

The label is the type. GitHub's Issue Types are an organisation feature and are
not used. A Feature's progress is its sub-issues' completion.

## Status

`Backlog -> Ready -> In Progress -> In Review -> Done`, the project's `Status`
field.

| Status      | Set by | When |
| ----------- | ------ | ---- |
| Backlog     | the project, on add | an issue is opened |
| Ready       | refinement | a Task is specified well enough to build without asking; a Feature once its Tasks exist |
| In Progress | `/implement-issue` | a Task is claimed; a Feature when its first Task is |
| In Review   | `/implement-issue` | a Task's pull request is open; a Feature's integration pull request is open |
| Done        | the project, on close | the issue closes |

An issue closes when the pull request carrying `Closes #<n>` merges. GitHub does
that for a pull request into `main` alone; for one into `milestone/**`,
`.github/workflows/close-milestone-issues.yml` does it.

## Refinement

Refinement is worked with the owner, in order: `/grill-with-docs #<feature>`,
then `/to-spec #<feature>`, then `/to-tickets #<feature>`. Where those skills
publish, they publish as follows.

**Publishing a spec** rewrites the Feature's body when the Feature exists, and
otherwise opens one labelled `type:feature`. The body adds a section to the
skill's template:

```markdown
## Milestone branch

`milestone/<name>`
```

**Publishing tickets** opens each Task labelled `type:task`, adds it as a
sub-issue of the Feature, records every blocking edge as a native dependency,
and sets its Status to Ready. The Status replaces the `ready-for-agent` label.
Then the Feature's Status goes to Ready.

Every Feature gets these Tasks beside its vertical slices:

- **Specs for `<criterion>`**, first. The failing Playwright specs under `e2e/`
  that state the acceptance criterion, in a pull request onto the milestone that
  touches nothing else (ADR-0002). The owner reviews it as code owner. It blocks
  every other Task.
- **Migration for `<change>`**, when the schema changes. The schema and its
  generated SQL, in a pull request to `main` (ADR-0013). It blocks the Tasks
  that use the new schema.

Every other Task stays out of `e2e/` and `packages/db/drizzle/`.

## Base branch

| Task                  | Pull request into |
| --------------------- | ----------------- |
| Specs                 | `milestone/<name>`, which this Task creates from `main` when it does not exist |
| Migration             | `main` |
| Any other Feature Task | `milestone/<name>` |
| Bug                   | `main` |

A pull request is squashed, and its body carries `Closes #<task>`.

## Operations

`gh` infers the repository inside a clone. Project writes need the token's
`project` scope (`gh auth refresh -s project`).

| Thing         | Id |
| ------------- | -- |
| Project       | `PVT_kwHOAPo8ps4Bj5BZ` (number 2, owner `kinchi22`) |
| Status field  | `PVTSSF_lAHOAPo8ps4Bj5BZzhirtAQ` |
| Backlog       | `f75ad846` |
| Ready         | `412e474e` |
| In Progress   | `47fc9ee4` |
| In Review     | `02ce40ea` |
| Done          | `98236657` |

```bash
# Read an issue, with its Status
gh issue view <n> --comments --json number,title,body,labels,state,assignees,projectItems

# Open one; the project adds it as Backlog
gh issue create --label type:task --title "..." --body "..."

# Set a Status: item-add returns the existing item when there is one
item=$(gh project item-add 2 --owner kinchi22 --url <issue-url> --format json --jq .id)
gh project item-edit --project-id PVT_kwHOAPo8ps4Bj5BZ --id "$item" \
  --field-id PVTSSF_lAHOAPo8ps4Bj5BZzhirtAQ --single-select-option-id <option-id>

# The database id, which the two endpoints below take instead of the number
gh api repos/{owner}/{repo}/issues/<n> --jq .id

# Sub-issues
gh api -X POST repos/{owner}/{repo}/issues/<feature>/sub_issues -F sub_issue_id=<task-db-id>
gh api repos/{owner}/{repo}/issues/<feature>/sub_issues

# Blocking: <task> is blocked by <blocker>
gh api -X POST repos/{owner}/{repo}/issues/<task>/dependencies/blocked_by -F issue_id=<blocker-db-id>
gh api repos/{owner}/{repo}/issues/<task>/dependencies/blocked_by

# Claim
gh issue edit <n> --add-assignee @me
```

The **frontier** of a Feature is its sub-issues that are open, in Ready, with no
assignee and no open blocker.
