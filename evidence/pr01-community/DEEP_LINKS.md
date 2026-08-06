# PR-01 Community deep links

## Routes

| Path | Page |
|---|---|
| `/community` | Discover feed |
| `/community/official` | Official feed (`source=official` locked) |
| `/community/creators` | Creators feed (`source=creators` locked) |
| `/community/content/:contentId` | Content detail |
| `/community/profile/:handle` | Publisher profile |
| `/design/community` | Legacy redirect → `/community/official` |

## Filter query params (Discover URL is source of truth)

- Same dimension: OR
- Across dimensions: AND
- Params: `source`, `style`, `occasion` (csv), `effect` (csv), `mood` (csv), `shape`, `length`, `application`, `verification`
- Product entry params preserved across filter updates: `entry`, `return_to`, `shape`, `length`

Example:

`/community?source=official&style=ST-01&occasion=party,date&effect=chrome,cat-eye`

## Entry / return

- App sidebar, Dashboard card, Wizard header, Editor top bar use `communityHref(...)`.
- Community header: Dashboard → `/`, Studio → `return_to` or `/design`.
- Refresh and direct deep links do not require Wizard selection.
