# COMM-v0.7.2-TAX-02 · Content Migration Report

Deterministic report over the shipped discovery fixtures. Fixed timestamp `2026-08-17T00:00:00.000Z`; manifest order; byte-stable across re-runs.

## Fixture validation

| Fixture | Result |
|---|---|
| `public/community/taxonomy-v2.json` | PASS — strict parse (89 tags) |
| `public/community/migration-manifest-v1.json` | PASS — strict parse (24 entries) |
| `public/community/content-index.json` | PASS — strict coverage (18 records, 0 blocked) |

## Summary counts

| Dimension | Counts |
|---|---|
| Total entries | 24 |
| Source class | LEGACY_CONTENT_INDEX 18 / CANONICAL_DEMO 1 / V0_7_2_LOOK_SET 4 / CREATOR_V1_FIXTURE 1 |
| Public status | MIGRATED 11 / MANUAL_REVIEW 4 / PUBLIC_BLOCKED 9 |
| Rights | ORIGINAL 15 / PENDING 9 |
| Makeability | CONCEPT_ONLY 24 |
| Migration state | LEGACY_STYLE_MIGRATED 15 / NEEDS_STYLE_REVIEW 4 / NONE 5 |
| Coverage blocked | 0 |

## Entries

| contentId | source class | public status | rights | makeability | migration | styles | techniques | review/block reason |
|---|---|---|---|---|---|---|---|---|
| `cc_mercury_dew` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:minimal-clean, style:glamorous-sparkling | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_petal_veil` | LEGACY_CONTENT_INDEX | MANUAL_REVIEW | ORIGINAL | CONCEPT_ONLY | NEEDS_STYLE_REVIEW | — | technique:french | french NEEDS_STYLE_REVIEW exception (technique:french, empty styleIds) |
| `cc_petal_pearl_bloom` | LEGACY_CONTENT_INDEX | MANUAL_REVIEW | ORIGINAL | CONCEPT_ONLY | NEEDS_STYLE_REVIEW | — | technique:french | french NEEDS_STYLE_REVIEW exception (technique:french, empty styleIds) |
| `cc_pearl_tide` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:boho-natural | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_micro_coquette` | LEGACY_CONTENT_INDEX | MANUAL_REVIEW | ORIGINAL | CONCEPT_ONLY | NEEDS_STYLE_REVIEW | — | technique:french | french NEEDS_STYLE_REVIEW exception (technique:french, empty styleIds) |
| `cc_starfish_bloom` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:boho-natural, style:glamorous-sparkling | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_sea_glass_chrome` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:boho-natural, style:minimal-clean | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_sunset_aura_glaze` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:artistic-abstract | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_liquid_chrome_statement` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:y2k, style:glamorous-sparkling | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_butter_glaze_quiet` | LEGACY_CONTENT_INDEX | MIGRATED | ORIGINAL | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:minimal-clean | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `cc_pugc_luna_blush` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:soft-delicate | — | rights PENDING (never public) |
| `cc_pugc_luna_pearl` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:cute-pop | — | rights PENDING (never public) |
| `cc_pugc_kai_circuit` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:y2k | — | rights PENDING (never public) |
| `cc_pugc_kai_oxblood` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:gothic-dark | — | rights PENDING (never public) |
| `cc_pugc_kai_mirror` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:futuristic | — | rights PENDING (never public) |
| `cc_pugc_mio_gallery` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:artistic-abstract | — | rights PENDING (never public) |
| `cc_pugc_mio_jewel` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:glamorous-sparkling | — | rights PENDING (never public) |
| `cc_draft_internal_gate` | LEGACY_CONTENT_INDEX | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | LEGACY_STYLE_MIGRATED | style:minimal-clean | — | rights PENDING (never public) |
| `look.v7-1.petal-veil` | CANONICAL_DEMO | MANUAL_REVIEW | ORIGINAL | CONCEPT_ONLY | NEEDS_STYLE_REVIEW | — | technique:french | french NEEDS_STYLE_REVIEW exception (technique:french, empty styleIds) |
| `look.v0-7-2.leopard-gilded-nude` | V0_7_2_LOOK_SET | MIGRATED | ORIGINAL | CONCEPT_ONLY | NONE | style:glamorous-sparkling | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `look.v0-7-2.crimson-reliquary` | V0_7_2_LOOK_SET | MIGRATED | ORIGINAL | CONCEPT_ONLY | NONE | style:gothic-dark | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `look.v0-7-2.ivory-lace-crystal` | V0_7_2_LOOK_SET | MIGRATED | ORIGINAL | CONCEPT_ONLY | NONE | style:soft-delicate | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `look.v0-7-2.honey-petal-glass` | V0_7_2_LOOK_SET | MIGRATED | ORIGINAL | CONCEPT_ONLY | NONE | style:soft-delicate | — | discovery gate passed (>=1 style, >=1 shape, non-PENDING rights, makeability) |
| `look.creator-fixture.petal-veil` | CREATOR_V1_FIXTURE | PUBLIC_BLOCKED | PENDING | CONCEPT_ONLY | NONE | style:soft-delicate | technique:french | rights PENDING (never public) |
