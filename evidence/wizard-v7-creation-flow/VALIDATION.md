# Wizard → Editor V7 Creation Flow Validation

Date: 2026-08-11
Base: `main @ 0189410`
Branch: `codex/fix-wizard-v7-creation-flow`

## Product decisions

- `/design/new?fresh=1` means a real new design; it clears the active Wizard draft and resets the in-memory singleton before binding an optional customer.
- Plain `/design/new` remains the recovery/resume route used by Template Gallery and active-draft recovery.
- The Wizard footer uses one stable label, **进入 Editor**. Existing EditorDoc presence changes only the explanatory title, not the action name.
- New blank/Wizard creation defaults to EditorDocV7. Existing schema 1–6 documents retain the V6 writer. Unsupported new V7 content is blocked rather than silently materialized as V6.
- Mercury Dew materializes a V7 cat-eye background, typed recipe instance, ribbon/droplet dimensional decorations, and gloss finish. Its 2D/2.5D and GLB outputs remain `SIMULATED`; manufacturing is unvalidated.

## Asset evidence

- Existing signed 2.5D golden registry: Almond/Oval/Coffin × natural/medium (6 fixtures).
- Imported from experimental commit `3965f41`: six shape/length shell `.web.glb` files, one ribbon GLB and three droplet GLBs.
- All ten browser GLBs have recorded SHA-256, byte size and bounds in `assets/glb/manifest.v1.json`.
- Raw GLBs, old V6 UI wiring, Cursor skills and legacy manifests were intentionally excluded.

## Browser E2E

Server: `http://127.0.0.1:5212`

1. Dashboard `新建设计` resolved to `/design/new?fresh=1`, then stripped the intent after consumption.
2. A previously persisted session opened at Step 1 with customer selection, not restored Step 2.
3. Selected customer → Almond → Medium → `下一步：选风格`.
4. Recommendation dialog displayed Mercury Dew and `应用 V7 配方方案` with simulated/unvalidated disclosure.
5. Applied Mercury → Wizard Step 2; the prominent `进入 Editor` CTA was visible.
6. First entry acknowledged the bridge warning and opened a shell with `data-editor-schema="7"`.
7. V7 document showed `cat_eye`, one dimensional step with five relief elements, and final `gloss` finish.
8. Returning to plain `/design/new` resumed the same design; the CTA remained `进入 Editor`. Re-entry opened the same V7 document without a V6 fallback or duplicate acknowledgement.
9. 1280×900: CTA 992×82px, no horizontal overflow.
10. 390×844: CTA moved ahead of the long gallery, 48px button target, gallery limited to internal 420px scroll, no horizontal overflow.
11. Console: no errors; only the known React Router future-flag warning.

## Automated gates

- `npm run typecheck` — PASS
- `npm run build:integration` — PASS (existing large-chunk warning)
- `npm run test:wizard-v7-flow` — PASS
- `npm run test:editor-v7-creation-cutover` — PASS
- `npm run test:pr06` — PASS
- `npm run test:template-gallery-hq` — PASS
- `npm run test:editor-v7-contract` — PASS
- `npm run test:editor-v7-runtime` — PASS
- `npm run validate-assets` — PASS
- `npm run validate-recipes` — PASS
- `git diff --check` — PASS

## Independent review

- Internal read-only flow and asset audits identified the active-draft ambiguity, V7 flag/fallback gap, Mercury recipe blocker and missing GLB set; the accepted fixes above close those findings.
- Claude Code was invoked after the repository owner granted standing project authorization, but the Packy call ended at its configured `$0.75` budget before returning a usable report. It was not retried automatically and is not counted as acceptance evidence.

## Known limits

- Mercury dimensional steps are canonical V7 data, but the general Editor surface/dimensional editing canvas remains scheduled for later V7 PRs; the current canvas explicitly labels non-background preview limits.
- Imported GLBs are simulated preview candidates and have not received manufacturing, fit, or physical validation.
- Design-list duplicate/new-version flows are outside this Wizard cutover and still need a separate version-neutral clone-to-V7 PR.
