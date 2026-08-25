# I18N Protocol v0.7.2

## Scope

All user-visible product copy is addressed by a stable, namespaced typed key. This includes headings, buttons, labels, placeholders, tooltips, `aria-*`, Toasts, errors, empty states and status text. Domain labels (taxonomy, Look, asset and other business entities) remain in their domain registries and are not duplicated in the generic catalog.

The blocking global audit walks all production `.tsx` files under `src`. It is a TypeScript AST audit over complete file contents, not a Git diff audit. It checks JSX text, `aria-label`/`title`/`placeholder`/`alt`, Toast/notify calls, removed compatibility `text()` use, CJK product literals and locale-aware domain presenter calls. The only exact file exclusions are the developer-only debug panel, mock failure injector and internal Surface Boolean proof page; every exclusion and technical literal is printed with its reason. A second bounded AST audit covers Editor `.ts` read models whose `label`/`shortLabel`/`description` fields reach product UI.

## Contract

`MessageCatalogV1` contains `schemaVersion`, `locale`, `revision` and a key/value map. The locale registry is the single extension point for canonical BCP-47 identifiers, legacy aliases, default locale and display metadata; `CanonicalLocale`, `SUPPORTED_LOCALES` and catalog coverage are derived from it. Legacy `zh`/`en` values are read aliases only. Keys use dot-separated semantic namespaces (`common.*`, `wizard.*`, `editor.*`, `community.*`, etc.) and must be unique. A key names module, scene/component and purpose (for example `community.feed.empty.noPublished` or `editor.topBar.save`); it must not derive from source copy, a hash, a line number, a long camelCase sentence or mechanical numeric suffix. `app.*` cannot own community/board/rights/share/asset domain copy. Every key must exist in every registered catalog.

`useLocale().t(key, params)` is the component API. Interpolation accepts simple `{name}` and `{count}` placeholders. Development missing keys are visible as `⟦key⟧` and logged; production falls back to the default `zh-CN` value, then returns the key when no default exists. The former `LocaleValue.text` compatibility API is removed; platform APIs such as `Response.text()` are unrelated.

## CRUD and release boundary

`MessageCatalogRepositoryV1` is backend-neutral. The local adapter supports list/get/create/update/archive plus atomic `createBundle`/`updateBundle`. Single-entry CRUD is a draft primitive. A bundle must contain exactly one value for every registered locale, pass placeholder parity and all expected-revision checks before any entry is written; failure is all-or-nothing. Repository storage is not a CMS, permission service or production publishing system. A release/publishability gate must pass exact parity, key quality, interpolation, fallback and audit tests. Rollback selects a prior immutable catalog revision; it does not mutate domain entities.

Creation accepts only `expectedRevision: undefined` or `0`; any other value is a revision conflict. Seed data is normalized to canonical locales and duplicate canonical `(locale,key)` identities are rejected. Legacy `zh`/`en` values are read aliases only; the provider writes back `zh-CN`/`en-US` after the first effect and synchronizes `document.documentElement.lang`.

Future adapters must separate `draft`, `published` and `archived` states. Suggested roles are translator (edit draft), reviewer (approve parity/terminology), publisher (release), and auditor (read audit trail); role enforcement is not implemented by this local adapter. Publishing records an immutable catalog revision and release actor. Rollback creates a new release pointing to a prior approved revision, never silently rewrites history. Draft CRUD in this branch is therefore an operational prototype, not a permission or production release system. The frozen legacy key baseline is an explicit compatibility inventory, may only shrink, and is checked for deleted keys.

## Component and migration rules

Import `useLocale` from `@/lib/i18n`, call `const { t } = useLocale()`, and use a typed key. Do not concatenate translated sentence fragments; pass structured params. Keep domain display names in their source contract, but pass the current locale explicitly to `localizedLabel`; a two-argument production call is rejected. Canonical/user data such as an EditorDoc title or custom step name is never rewritten on language change. Built-in read-model labels must use typed keys at the presentation boundary. New components and tests review parity, fallback, persistence, document language and raw-key visibility.

## Evidence

This implementation is local and backend-neutral (`integrated` for the repository code and `prototype` for operational catalog management). It does not claim a CMS, production permissions, remote synchronization or translator workflow. To add a language: add one registry definition (canonical BCP-47 locale, aliases, display metadata and default policy), add its catalog satisfying `Record<MessageKey,string>`, extend no scattered locale switch, then run bundle completeness/placeholder parity, fallback, CRUD/release gate and E2E persistence checks. No locale is publishable until its atomic bundle passes.
