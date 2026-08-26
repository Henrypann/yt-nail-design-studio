# i18n v0.7.2 validation

## Scope

Implemented the componentized catalog/provider/format/repository split, a registry-derived locale contract, canonical locale persistence (`zh-CN`/`en-US`) with legacy read aliases, typed `t(key, params)` over 2,077 catalog keys, atomic bundle CRUD, development-visible missing keys, a backend-neutral in-memory CRUD adapter, protocol and repository tests, and the default AGENTS rule. Integration adds the secure-context Title/Description/Action keys in both locales.

All 2,077 bilingual catalog keys have exact zh-CN/en-US key and placeholder parity. New keys are subject to semantic namespace quality gates; 111 pre-gate violations are frozen in an explicit compatibility baseline that cannot grow. Domain registry labels use locale-explicit `localizedLabel`; `Response.text()` remains a platform API and is not product copy. The blocking global AST audit covers 138 production TSX files, with three developer-only exact exclusions printed by the audit. A bounded Editor read-model audit covers visible labels returned from production `.ts` models.

## Commands

- `npm run test:i18n` — passed: 2,077-key exact parity, placeholder parity, aliases/canonical persistence, missing-key fallback, namespaces, interpolation, single-entry CRUD, atomic bundle completeness/placeholder/revision guards and archive read boundary.
- `npm run audit:i18n` — passed: complete-file TypeScript AST audit, 138 production TSX files, 0 findings, 3 exact exclusions and 6 exact technical literals. Key-quality gate and frozen legacy baseline checks also passed.
- `npm run audit:i18n:p0` — passed: TypeScript AST audit over the exact 14-file P0 scope, 0 raw product literals. Allowlist is limited to shape capability availability labels and Twin mock status domain labels, each with an explicit reason in the audit output.
- `npm run audit:i18n:editor-v7` / `npm run audit:i18n:platform` / `npm run audit:i18n:community` — passed; 36 / 14 / 29 files, 0 raw UI literals.
- `npm run audit:i18n:editor-read-models` — passed; Editor stage/lane/geometry read-models expose typed keys or structured data rather than raw UI copy.
- `npm run test:editor-v7-workspace-ia` — passed after the stage/lane key contract migration.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run build:integration` — passed.
- `git diff --check` — passed.

## Governance hardening

Locale metadata is centralized in `src/lib/i18n/locale-registry.ts`; the explicit catalog map forces a compile-time catalog for every registered locale. `createBundle`/`updateBundle` are all-or-nothing release primitives, while single-entry CRUD remains draft-only. The key-quality gate rejects new source-copy-derived camelCase, numeric-suffix and forbidden `app.*` domain keys; the frozen legacy baseline is checked for deletion and can only shrink. `LocaleValue.text` is removed.

## Evidence and limits

Evidence level is `integrated` for the local provider/contracts and `prototype` for catalog operations. This is not a CMS, remote translation backend, production permission service or release pipeline. Developer-only debug/mock/geometry proof text remains outside the catalog only through the three exact exclusions printed by the global audit.

Visible browser acceptance passed on the built local preview:

- Community: `zh-CN → en-US`, English chrome, taxonomy browse labels and capability badges; refresh retained `en-US` and `document.documentElement.lang === "en-US"`.
- Quick Start: English customer/shape/length/dialog flow, then `en-US → zh-CN` after closing the modal; `document.lang` changed to `zh-CN`.
- Editor V7: created a blank design and verified the Chinese surface; after switching to English, stage labels, guided lanes, geometry summary, built-in layer names and ARIA text rendered in English.

Persisted design titles and user/custom step names are canonical user data, not product chrome, and are intentionally not rewritten when language changes. Responsive viewport coverage and production translation workflow are not claimed by this i18n acceptance run.
