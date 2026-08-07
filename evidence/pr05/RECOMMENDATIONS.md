# PR-05A recommendation acceptance

- The production recommendation modal calls the shared partitioner and shows at
  most two validated curated templates plus one validated concept template.
- Equal priorities use the stable recommendation ID as a tie-break.
- Missing concept targets are removed without blocking curated choices.
- Each async open/shape request has a monotonically increasing token; stale
  responses cannot replace the current shape's cards.
- Style and template state mutate only after library validation and a successful
  Step 1 transition. A missing target, failed library load or failed transition
  leaves those fields unchanged.
- Cover failures render an honest placeholder while preserving a separately
  validated application target.
- The modal uses a viewport-bounded flex layout with a scrollable card region;
  its footer action remains outside that scroll region.
