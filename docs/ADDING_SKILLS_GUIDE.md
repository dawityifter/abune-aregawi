# How to add Claude skills to this project

A "skill" is a markdown file Claude reads on demand when a task matches its description —
instead of you re-explaining a workflow every session, or Claude re-deriving it from the
codebase and burning tokens.

## Where they live

```
.claude/skills/<skill-name>/SKILL.md
```

Note: `.claude/` is currently in `.gitignore`, so skills live on your machine only — a
fresh clone of this repo gets this guide but none of the skills below. If we decide these
should be shared across machines and contributors, add `!.claude/skills/` to `.gitignore`.

Every skill is its own folder with one `SKILL.md` inside. That's the minimum. (A skill folder
can also hold helper scripts/templates alongside SKILL.md, but for most project workflows
a single file is enough.)

## The format

```markdown
---
name: "skill-name"
description: "One or two sentences: what this is for, and the phrases that should trigger it."
---

Body: the actual instructions, in plain markdown. Commands, gotchas, file pointers.
```

The **description is what gets matched against your request** — Claude scans skill
descriptions to decide which one (if any) applies, before loading the full body. A vague
description ("helps with the database") won't trigger reliably. A specific one ("Use when
adding or running a migration... trigger on 'add a migration', 'run migrations', 'rollback'")
will.

## Step by step to add a new one

1. **Notice a repeated pattern.** If you've explained the same workflow to Claude more than
   once, or Claude has had to re-read the same 4 docs to figure something out — that's a
   skill candidate.
2. **Create the folder and file**: `.claude/skills/<name>/SKILL.md`.
3. **Write the description first.** Be concrete about trigger phrases — this is the single
   biggest factor in whether the skill actually fires when needed.
4. **Write the body**: point to the authoritative doc if one exists (don't duplicate it),
   list the actual commands (verified, not guessed), and call out anything dangerous
   (production DB, real member data, irreversible actions).
5. **Test it**: start a fresh Claude session in this repo and ask for the task the skill
   covers. If Claude doesn't use it, the description usually needs to be more specific.
6. **Keep it lean.** Skills are meant to save tokens, not spend them — a 300-line skill
   defeats the purpose. Link out to `docs/*.md` or `backend/*.md` for anything long.

## One environment quirk to know

If you're asking Claude (in Cowork) to create or edit files under `.claude/` for you, its
file-editing tools refuse to touch that directory directly as a safety guardrail — you'll
see it fall back to writing the file via a shell command instead, which works fine but is
worth knowing about. If you're using Claude Code (the CLI) or just editing by hand in your
editor, there's no such restriction — `.claude/` is a normal folder on your machine.

## Using the built-in skill-creator

For more polished or shareable skills (with evals, performance testing, description
tuning), invoke the `skill-creator` skill and describe what you want — it will walk through
drafting, testing, and refining a SKILL.md rather than you hand-writing one.

## What's already here

- `.claude/skills/db-migrations/` — the two migration systems in `backend/`, when to use each.
- `.claude/skills/ledger-sheets-export/` — the ledger → Google Sheets export/sync feature.
- `.claude/skills/payment-reconciliation/` — Zelle/bank matching, the psql debugging pattern.

Use these as templates for tone and length when writing new ones.
