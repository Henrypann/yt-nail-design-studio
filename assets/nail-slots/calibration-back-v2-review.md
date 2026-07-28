# NailSlot V2 calibration review — Back line-art

**Plate:** `assets/visual-plates/back/back-line-art-approved-v1.png` (1200×900)  
**Data:** `assets/nail-slots/slots.back.v2.json`  
**Overlay:** `assets/nail-slots/calibration-back-v2-overlay.png`

## Self-check

| Check | Result |
|---|---|
| 10 independent slots (L1–L5, R1–R5) | Yes |
| Target = inner nail-bed outline | Yes (outer fingertip not used as clip) |
| Asset-native 1200×900 px | Yes |
| Affine per finger (sx/sy + rotate + translate) | `transform[6]` |
| Local UV root(0.5,1) / tip(0.5,0) | Yes |
| Thumb/pinky not centre-finger clones | Yes (distinct rot/width; L/R not pure mirror) |
| Legacy nailScale bypassed for this plate | Documented in JSON `local_uv_contract.legacy` |
| Wizard / Editor / renderer untouched | Yes |

## Known source limitations

- Soft anti-aliased ink on cream makes automatic contour tracing unreliable; landmarks are hand-tuned against the plate + overlay QA.
- Decorative watercolor / leaf / sparkle elements are non-functional noise near corners only.
- Line-art nail beds are shorter/narrower than photoreal nail beds; this canvas is a **neutral pre-scan visual**, not a manufacturing scan — do not derive production mm from pixel lengths alone.
- Affine (no mesh warp) means highly curved cuticle seats are approximated; ≤2px root/tip target may need a second pass in the HTML calibrator if a specific finger looks off.

## Agent 3 / 4

Not started. Ready for human review of overlay alignment before renderer integration.
