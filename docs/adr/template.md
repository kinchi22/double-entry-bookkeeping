# ADR-NNNN: Title in the imperative

Use this template only when the decision is hard to reverse, surprising without
its context, and the result of a real trade-off. Current configuration and
operating instructions belong beside the thing they configure instead.

**Status:** Accepted
**Date:** YYYY-MM-DD

Status is one of:

- `Accepted` -- in force now. `AGENTS.md` treats it as binding.
- `Deferred` -- decided, deliberately not built. Requires a `**Trigger:**` line
  saying what has to be true before it is. Adopting it means editing this file:
  change the status to `Accepted`, add `**Adopted:** YYYY-MM-DD, PR #N`, and
  leave the rest of the ADR intact so the reasoning stays readable.
- `Superseded by ADR-NNNN` -- replaced. The replacement must exist. A
  `Deferred` ADR replaced before it was adopted keeps its trigger and takes no
  `**Adopted:**` line.

An ADR whose decision still stands but whose record has gone out of date is
amended in place: correct the passages, and add `**Amended:** YYYY-MM-DD, PR #N`
directly under `**Date:**`. The status and the index row in
`docs/ARCHITECTURE.md` do not change -- this is not a supersession, and there is
no status for "superseded in part". Use it when what was decided is unchanged
and only the description of it is wrong, as ADR-0006 was about where `E2E build`
runs. A decision that no longer stands is `Superseded by ADR-NNNN` instead. No
gate checks this line; the form above is the whole rule.

## Problem

What forced a decision. Facts and measurements, not preferences.

## Decision

What was chosen, stated so that someone can tell whether code complies.

## Consequences

What this costs, including the parts that are worse than the alternative.

## Rejected alternatives

Each one, and the specific reason it lost. An ADR with no rejected alternative
is a note, not a decision.
