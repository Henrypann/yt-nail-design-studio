# COMM-V7.1-02 · Explore & Search — Validation

Date: 2026-08-11
Base: integration/community-v7-1 after COMM-V7.1-01
Branch: codex/pr-comm-v7-1-02-explore-search
Evidence level: production-ready pure search/ranking and UI path over static integration
fixtures; Trending analytics, Nail Board Save and Made/RealResult are explicitly unavailable.

## Scope and contracts

- `/community` remains Explore; canonical Search is `/community/search` inside the
  Community shell.
- URL is the share/refresh truth for `tab/q/sort/source/style/color/shape/length` and
  existing occasion/effect/mood/application/verification filters.
- Featured uses only `FEATURED_BY_OFFICIAL` or explicit `recommended`; arbitrary tags
  are not editorial proof. New uses `publishedAt` descending with lookId tie-break.
- Trending uses injected `asOf`, a 7-day window and at least 3 distinct session samples
  per visible Look. Empty/insufficient/unknown-Look signals fail closed to Featured with
  an explicit disclosure. Current fixtures provide no signals.
- Looks consume `PublishedLookReadModelV1`. Creator search returns only Creator-type
  publishers and applies production demo visibility.
- Cards are semantic articles. Save is disabled until COMM-03, Use opens canonical Look
  detail for evidence review, and Made stays `—` until a verified RealResult/Fulfillment
  record exists. No local fake state, Like count, engagement or Three.js feed render.

## DSF worker and primary review

Hermes DSF was the bounded single writer and stopped without commit at its iteration cap.
Codex then independently fixed/closed:

- stale regression gates after replacing `CommunityContentCard` with `CommunityLookCard`;
- absolute-path bug in the no-Three source walk;
- preservation of Studio `entry/return_to/shape/length` context across Community links;
- Featured overreach from arbitrary campaign tags;
- invalid/unknown/hidden Look Trending signals and invalid clock/config fail-closed rules;
- Creator tab mixing the official platform publisher into Creator results;
- repeated empty-state rendering;
- stable per-mount ranking clock, explicit Enter submission, and 44px new touch controls;
- Made wording corrected to verified RealResult/Fulfillment evidence, not inferred
  manufacturing data.

## Automated gates

- `npm run typecheck` — PASS
- `npm run build:integration` — PASS
- `npm run test:community-v7-1-explore-search` — PASS (`devLooks=11`, `prodLooks=4`)
- `npm run test:community-v7-1-look-adapter` — PASS
- `npm run test:community-v7-1-design-content` — PASS
- `npm run test:community-v7-1-identity` — PASS
- `npm run test:community-domain` — PASS
- `npm run test:community-content` — PASS
- `npm run test:community-official` — PASS
- `npm run test:community-taxonomy` — PASS
- `npm run test:community-intent` — PASS
- `npm run test:community-studio-flow` — PASS
- `git diff --check` — PASS

## Browser walkthrough

Server: `http://127.0.0.1:5212`.

- 1440×900: Search restored `q=mercury&sort=trending&shape=almond&color=champagne`,
  rendered one Mercury Dew Look, disclosed Trending→Featured fallback, and exposed
  disabled Save / canonical Use / Made `—`. No document overflow.
- Keyboard: ArrowRight moved focus and selection from Looks to Creators and updated
  `tab=creators`; clearing q rendered exactly 3 demo Creator cards with canonical profile
  links. Enter on the searchbox wrote `q=zzzz-no-match` and produced one empty state.
- Refresh: q, Trending selection, Champagne and Almond state restored exactly from URL.
- 1280×800, 1024×768, 768×900, 390×844: body/document widths were respectively
  1265/1009/753/375 for inner widths 1280/1024/768/390; no horizontal overflow.
  Look tabs, sort, filter toggle and Save/Use controls all measured 44px high.
- 390 filter drawer: width 343px inside the 375px document; all measured chip/select/
  close controls were 44px high; no document overflow.
- Console errors/page errors observed: 0.

Known visual inheritance: Community shell header controls predate COMM-02 and some remain
below 44px on mobile; all new Explore/Search controls meet the 44px gate. Fetch error/retry
UI remains implemented and regression-checked at source, but the current in-app browser
surface did not inject a component-level network failure. Loading, ready, empty, missing
cover fallback code and retry state are preserved.

## Evidence classification

- Production-ready: URL contract, pure search/filter/ranking, route/UI wiring,
  accessibility semantics, deterministic fallback and responsive layout.
- Static/simulated: legacy Look fixtures and demo Creator profiles; no live backend.
- Unavailable by design: Trending analytics samples, Nail Board persistence (COMM-03),
  verified Made/RealResult metrics (COMM-07).
- Unverified: manufacturing eligibility, device dispatch and physical production claims.
