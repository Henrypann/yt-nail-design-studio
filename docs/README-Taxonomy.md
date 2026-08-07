# Nail Art Element Taxonomy (US)

This document is the compatibility contract for Community, Wizard and Editor.
Machine IDs are locale-neutral. Changing the UI locale must change display text
only; it must never rewrite Community content, Wizard selections, recipes,
layers or `EditorDocV6`.

Preview evidence is not manufacturing evidence. The taxonomy describes design
intent and product navigation, not vendor-private manufacturing parameters.

## Ownership and hierarchy

| Domain | Machine-ID owner | Display-label owner | Notes |
|---|---|---|---|
| Shape | `material-library/shapes/shape-capabilities.json` and generated `shape-types.ts` | `nail-taxonomy-labels.ts` | US shape names remain English in both locales |
| Geometry length | `NailLength` | `nail-taxonomy-labels.ts` | `short` / `medium` / `long` / `extra-long` |
| Design length | `taxonomy-model.ts` | `nail-taxonomy-labels.ts` | Scan-relative preset; not interchangeable with geometry length |
| Coverage, optical effect, top finish | `taxonomy-model.ts` | `nail-taxonomy-labels.ts` | Appearance values remain separate dimensions |
| Editor layer | Editor layer contract | `nail-taxonomy-labels.ts` | Exactly six `builtin.*` layer types |
| Attachment assets | `assets/decorations/manifest.json` | `nail-taxonomy-labels.ts` | Wizard runtime attachments |
| Community browse tags | `public/community/taxonomy.json` | shared resolver + fixture fallback | Fixture labels are validated; IDs remain content data |

Shared resolver: `src/studio/shared/nail-taxonomy-labels.ts`.
Studio enum contract: `src/studio/editor/lib/taxonomy-model.ts`.

The hierarchy is:

1. Geometry: Shape → Geometry Length.
2. Appearance: Base Coverage → Optical Effect → Top Finish.
3. Editor structure: Layer → Pattern / Attachment / Relief element.
4. Discovery metadata: Community Style / Occasion / Mood / Effect / Color /
   Season / Subject.

The resolver always requires a namespace. This prevents ambiguous IDs such as
`pearl` from being treated as the same concept when it means an optical effect,
a Wizard finish or an attachment asset.

## US labels and canonical IDs

| Namespace | Canonical IDs | English display |
|---|---|---|
| Shape | `almond`, `oval`, `square`, `round`, `coffin`, `squoval`, `stiletto`, plus capability-registry shapes | Almond, Oval, Square, Round, Coffin, Squoval, Stiletto |
| Geometry length | `short`, `medium`, `long`, `extra-long` | Short, Medium, Long, XL |
| Optical effect | `none`, `cat-eye`, `aurora`, `silk`, `pearl` | None, Cat-Eye, Aura, Velvet, Pearlescent |
| Top finish | `gloss`, `matte` | Glossy, Matte |
| Layer | `builtin.base_surface`, `builtin.draw`, `builtin.art_2d`, `builtin.relief`, `builtin.attachment`, `builtin.recipe` | Base, Hand Paint, Art 2D, Relief, Charms & Accents, Recipe |

Chrome, Holo, Foil and Glitter remain Community discovery tags until their
manufacturing semantics are signed off. They must not be silently added to the
Editor optical-effect enum.

## ID and alias compatibility

Aliases are deprecated read/search compatibility inputs. When a legacy alias is
normalized at an explicit ingestion boundary, the canonical ID is saved. Merely
switching locale never normalizes or rewrites data.

| Namespace | Legacy alias | Canonical ID | Status and behavior |
|---|---|---|---|
| Geometry length | `xlong` | `extra-long` | Deprecated; explicit normalization supported |
| Geometry length | `extra_long` | `extra-long` | Deprecated; explicit normalization supported |
| Optical effect | `cat_eye` | `cat-eye` | Deprecated; explicit normalization supported |
| Optical effect | `cateye` | `cat-eye` | Deprecated; explicit normalization supported |
| Community effect | `cat_eye` | `cat-eye` | Deprecated search/import alias |
| Community effect | `cateye` | `cat-eye` | Deprecated search/import alias |

`coffin` and `ballerina` remain distinct registered IDs; their similar US usage
does not authorize destructive migration. Aura/Airbrush/Blush, Ombré/Gradient,
Rhinestone/Gems/Crystals and Chrome/Mirror/Glazed Donut are search vocabulary,
not stored-ID migrations in this release.

Unknown IDs use a deterministic localized `Unknown (id)` / `未知（id）` fallback.
If a Community fixture supplies a localized label, the shared resolver uses that
fixture label before the unknown fallback. No call site may render `undefined`.

## Compatibility rules

- Stored Community fields, Wizard state, recipes, layer `typeId` values and V6
  documents contain IDs only, never localized labels.
- V1–V5 migration preserves canonical IDs; its V6 output must still validate.
- V6 save/reload preserves IDs byte-for-byte apart from normal repository clone
  semantics.
- A language switch changes resolver output only.
- Default locale remains Chinese. English default is deferred until auth,
  dashboard, Community, Wizard, Editor, errors, confirmation and export states
  have one verified end-to-end language switch path.

## Do not invent Editor modules

| Requested category | Correct home |
|---|---|
| Motif / freehand pattern | `builtin.art_2d` / `builtin.draw` and pattern-element kinds |
| Texture paint layer | Coverage + optical effect + top finish |
| Charm layer | `builtin.attachment`; charm is a catalog/route concept |
| Chrome/Holo/Foil/Glitter optical IDs | Deferred pending manufacturing verification |
| Material picker as a design layer | Manufacturing definition/adapter, outside PR-08 |
