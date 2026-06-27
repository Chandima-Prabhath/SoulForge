# Contributing to SoulForge

A short guide so future contributors (humans and AI assistants alike) follow the same workflow.

## Branch Strategy

We use a simple GitHub-Flow-ish model:

- **`main`** — always shippable. Every commit on `main` should build and run.
- **`feat/<scope>`** — feature branches for new development. Examples:
  - `feat/phase-2-skill-grammar`
  - `feat/phase-3-devour-system`
  - `feat/procedural-realm-gen`
- **`fix/<scope>`** — bug fix branches. Example: `fix/projectile-collision-ghosting`
- **`docs/<scope>`** — documentation-only changes. Example: `docs/expand-glossary`

### Rules

1. **Never commit directly to `main`** — always work on a feature branch.
2. **One branch per phase / feature.** Don't mix Phase 2 work with Phase 3 work on the same branch.
3. **Commit regularly** — small, focused commits are better than huge "done everything" commits. Aim for at least one commit per work session, more if it makes sense.
4. **Push regularly** — push the feature branch to GitHub after each commit (or at the end of each session). Don't let work live only locally.
5. **Merge to `main` when the phase is complete and verified.** Use a fast-forward merge or a PR if you prefer the GitHub UI.
6. **Delete the feature branch after merge** — keeps the branch list clean.

## Commit Message Convention

We use a simple prefix convention:

```
<type>: <short description in present tense>

<optional body explaining why, not what>
```

### Types

- `feat:` — new feature (e.g., `feat: add skill grammar engine`)
- `fix:` — bug fix (e.g., `fix: projectile collision missing enemies at edge of hitbox`)
- `docs:` — documentation only (e.g., `docs: expand divergence layer explanation in README`)
- `refactor:` — code restructure with no behavior change
- `test:` — adding or updating tests
- `chore:` — tooling, deps, configs (e.g., `chore: bump pixi.js to 8.7.0`)
- `phase:` — milestone commit marking the completion of a roadmap phase

### Examples

```
feat: add 5 elements × 3 forms × 5 modifiers to skill grammar

Registers Fire, Frost, Lightning, Void, Soul as elements. Each form
(Projectile, Beam, Nova) interprets the element differently. Modifiers
stack up to 3 deep. 75 base combinations now possible.
```

```
fix: prevent player from being removed from cleanupDeadEntities twice

Race condition: handleDeath() marked the player as dead, then both
cleanupDeadEntities() and lifetimeSystem() tried to removeEntity() in
the same frame. Guarded with hasComponent() check.
```

```
phase: complete Phase 2 — Skill Grammar v1

Player can now craft skills in a basic UI, save them to the grimoire,
and equip them to slots 2-4. Mana Bolt is now grammar-driven (Element:
Force, Form: Projectile, Vector: Ranged). Procedural VFX per element.
```

## Pushing to GitHub

The maintainer (or AI assistant) pushes via a temporary PAT. The token
is **never** stored in `.git/config` — it's used once for the push, then
stripped immediately. Always verify with:

```bash
grep -rq "github_pat_" .git/ && echo "TOKEN LEAK!" || echo "clean"
```

## Code Style

- **TypeScript strict mode** — no `any` unless absolutely necessary, and even then add a comment.
- **Pure Game Core** — anything under `src/core/` must have **zero** PixiJS, DOM, or networking imports. This is what enables future co-op (same code runs on server).
- **Components are data, systems are functions** — ECS discipline. Don't put behavior in components.
- **All paragraphs in docs ≥ 3 sentences** — no shallow content (per the project's content depth standards).
- **No emojis in code or docs unless explicitly requested.**

## File Organization

See README §10.3 for the canonical layout. Quick summary:

```
src/
├── core/         # pure TS, no rendering — shareable with server
├── client/       # PixiJS rendering, DOM, input
├── data/         # JSON-like data files (atoms, enemies, biomes)
├── net/          # network abstraction (placeholder for co-op)
└── types/        # shared TS types
```

## Testing

Currently we use **manual verification via headless browser** (agent-browser). Automated tests will be added in Phase 5+ once the systems stabilize. When verifying a change:

1. `npm run typecheck` must pass.
2. `npm run build` must succeed.
3. Boot the dev server, exercise the changed feature in the browser via `agent-browser`.
4. Check the browser console for errors.
5. Take a screenshot for the `download/` folder if the change is visual.

## Worklog

Every work session appends to `/home/z/my-project/worklog.md` (which is committed to the repo). The format is:

```
---
Task ID: <phase-or-task-name>
Agent: <agent name>
Task: <what was asked>

Work Log:
- <step 1>
- <step 2>

Stage Summary:
- <results>
- <files produced>
- <next phase>
```

This is the project's memory. Read it before starting work; write to it when finishing.
