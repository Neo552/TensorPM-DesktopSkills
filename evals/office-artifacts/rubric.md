# Office Artifact Skill Evals

Use these evals to check two different surfaces:

1. **Trigger accuracy**: the model should load the right format skill and avoid
   unrelated skills.
2. **Output quality**: the produced artifact should improve when the relevant
   skill is installed and approved.

## Trigger Eval Procedure

Run every query in `trigger-queries.json` at least three times against the same
model and routing configuration.

For each run, record:

- Which skill descriptions were present in `[Available Skills]`.
- Whether the agent called `describe_skill`.
- Which skill IDs were loaded.
- Whether the final answer attempted the requested artifact workflow.

Pass criteria:

- Recall: at least 90% of cases in `expectedSkills` are loaded.
- Precision: no more than 5% of cases load a `forbiddenSkills` entry.
- German prompts should perform at the same threshold as English prompts.

## Output Eval Procedure

For each task in `output-quality-tasks.json`:

1. Run once without the matching skill installed or approved.
2. Run once with the matching skill installed and approved.
3. Grade both artifacts with the task rubric.
4. Keep raw artifacts, tool traces, and scores together.

A skill version is release-ready when:

- Average score with the skill is at least 80/100.
- Skill-on average improves over skill-off by at least 10 points, or already
  exceeds 90/100.
- No blocker finding remains in generated artifacts.
- Visual artifacts use a closed token/design-contract layer when the task is
  external, executive, client-facing, or print-ready.
- Reviews cite structured evidence such as cells, pages, slides, sections,
  layout constants, row counts, or rendered-preview observations.
- Backend-authored PPTX/DOCX/PDF artifacts use their format-specific author
  tool, return a durable edit id, and pass the integrated reviewer/repair gate.

## Design-Token And Anti-Slop Checks

For PPTX/PDF output, check whether the artifact:

- Commits to one content-specific visual direction.
- Uses one dominant color, one supporting neutral, and one accent rather than
  an equal-weight palette.
- Defines reusable colors, font sizes, spacing, and layout constants instead
  of scattering raw values.
- Avoids generic AI-deck/report tells: purple gradients, decorative blobs,
  centered body text, title accent lines on every page, tiny dense tables, and
  repetitive card layouts.
- Uses color semantically and pairs color-coded states with text labels.

Do not penalize a runtime for lacking corporate-template editing or full
PPTX-to-image rendering if the agent clearly states the limitation and still
performs the available structural checks.

## Review Scoring

Use this severity scale when the `artifact-reviewer` skill is under test:

- **Blocker**: artifact should not be shared; core request, data correctness,
  file validity, or severe layout/readability is broken.
- **Major**: artifact is usable only after fixing a concrete content, layout,
  or reconciliation issue.
- **Minor**: issue is visible but does not change the core decision/use case.
- **Polish**: optional improvement with low risk.

The reviewer must give evidence and a concrete fix path for every blocker or
major issue.

## Iteration Budget

For render-and-critique loops, score the first three passes only unless the
task explicitly asks for exhaustive polish. The expected behavior is:

- First pass finds blocker/major issues.
- Subsequent passes verify only affected areas.
- Stop when no blocker/major issues remain, or recommend simplifying the
  artifact if problems persist after three passes.
