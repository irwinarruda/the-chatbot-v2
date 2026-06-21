---
name: plan-creator-guide
description: Create new project planning documents plans, specs, and prompts using numbered filenames under .agents/plans, .agents/specs, and .agents/promts. Use this skill whenever the user asks to create, draft, add, or start a plan, spec, or prompt document, even casually ("make a spec for...", "write a plan", "new prompt"). Always use the bundled deterministic script to choose the next xxx number instead of guessing or manually counting.
---

# Planning Document Creator

Use this helper when the user wants a new planning-oriented Markdown document in the project agent workspace.

## Document locations

Create documents in these directories:

- plan: `.agents/plans/xxx-{name}.md`
- spec: `.agents/specs/xxx-{name}.md`
- prompt: `.agents/promts/xxx-{name}.md`

The prompt directory is intentionally `.agents/promts` because that is the project convention provided by the user. Do not silently rename it to `.agents/prompts` unless the user explicitly asks to migrate the convention.

## Workflow

1. Infer the document type from the user's request: `plan`, `spec`, or `prompt`.
2. Derive a short descriptive name from the request when the user does not provide one.
3. Run the bundled script from the project root so numbering is deterministic:

   ```bash
   bun .agents/skills/plan-creator-guide/scripts/create-document.mjs --type plan --name "project setup"
   ```

4. Use the path printed by the script for any follow-up edits.
5. If the user provided content or requirements, fill the created scaffold with that content. If they only asked to create the document, leave the lightweight scaffold in place.

## Numbering rule

Do not guess or manually count existing files. The script scans the target directory's current items, finds filenames that begin with a number followed by `-`, then creates the next three-digit number (`001`, `002`, `003`, ...). This keeps naming stable and reproducible.

## Script usage

```bash
bun .agents/skills/plan-creator-guide/scripts/create-document.mjs --type spec --name "billing retry behavior"
bun .agents/skills/plan-creator-guide/scripts/create-document.mjs --type prompt --name "support triage"
```

Optional flags:

- `--root <path>`: use a project root other than the current working directory.
- `--print-only`: print the next path without creating the file.

## Content guidance

Keep the first version simple. These documents are starting points, not final architecture documents.

- Plans should focus on goal, steps, risks, and validation.
- Specs should focus on problem, requirements, acceptance criteria, and open questions.
- Prompts should focus on objective, context, instructions, and expected output.

Prefer concise, useful placeholders over large templates. The user can refine the document after it exists.
