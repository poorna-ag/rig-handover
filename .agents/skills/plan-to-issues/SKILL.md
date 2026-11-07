---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo (see "What every issue carries" below).
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --label "plan:<plan>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Decided by the human for plan `morning-digest` (7 November 2026). Use it for every plan unless
the human changes it.

- Label: `plan:<plan>` from the plan's frontmatter (e.g. `plan:morning-digest`). Create it once
  with `gh label create` if it doesn't exist.
- Body, in this order:

  ```md
  Source: plan.md § <n>

  ## Scope
  <what to build, which files>

  ## Done when
  <the plan's check, word for word>

  ## Blocked by
  <#n, or —; name a person too when the issue waits on one, e.g. "the reviewer's review">

  ## Suggested model
  <strongest | cheaper, and why in a few words>
  ```

## Steps that wait on someone

Some issues end with another person: a reviewer reading a preview, a human approving. Such an
issue stays open until that person has acted, even if its "Done when" line only says "sent".
Say so in its Blocked by, and block the next step (e.g. the clean-up) on it. Closing it early
is what went wrong on plan `morning-digest` (#6 was closed before the reviewer looked).

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
