# docs/agents

Everything an agent needs that is not a rule. The rules are the working
agreement in `AGENTS.md`; this directory holds what the agreement points at.

Each file has a **kind**, and the kind says how to read it:

- **Index** -- this file. It names what exists and nothing else.
- **Reference** -- prose to consult when a rule sends you here. It states facts
  and conventions; it is not a procedure, so nothing in it is a step to run.
- **Skill body** -- a procedure, followed from the top when its Skill is
  invoked. Each harness reaches it through a stub in its own skill directory,
  because no harness reads another's. `harnesses.md` maps that out.

| File | Kind | What it holds |
| ---- | ---- | ------------- |
| `README.md` | Index | This table. Every file here, with its kind. |
| `harnesses.md` | Reference | One table mapping each neutral concept the agreement uses to the mechanism each harness gives you, and the Harness vocabulary. The only file allowed to name a harness's own directory. |
| `issue-tracker.md` | Reference | The work items, Status values, base branch per Task and the `gh` commands, for GitHub Issues and the project board. |
| `skills/implement-issue.md` | Skill body | The Driver's brief: pick a Task, dispatch an Implementer Subagent, review what comes back, merge it or stop for the owner. |
| `skills/implement-issue-implementer.md` | Skill body | The Implementer's brief: build one Task and open its pull request. Dispatched by the Driver, never read alongside the Driver's brief. |

A new file here is added to this table in the same change that creates it.
