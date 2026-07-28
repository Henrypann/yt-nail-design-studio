# NailSlot V2 Calibrator (Back line-art)

Dev-only tools for the approved Back plate. **Does not** wire into Wizard / Editor / shared renderer.

## Plate

- `assets/visual-plates/back/back-line-art-approved-v1.png` — 1200×900 approved line-art
- Data: `assets/nail-slots/slots.back.v2.json`
- Overlay screenshot: `assets/nail-slots/calibration-back-v2-overlay.png`

## Run calibrator

```bash
# from repo root — any static server that can read /assets
npx --yes serve -p 7788 .
# open http://localhost:7788/tools/slot-calibrator/calibrator.html
```

Shows contour / root line / center axis / tip / finger ID. Drag tip · rootL · rootR, then re-export overlay PNG from the UI if you tweak.

## Tests

```bash
node tools/slot-calibrator/test-slot-math.mjs
```

## Math (Agent 3)

See `slot_math.ts`:

- Local UV: root `(0.5,1)`, tip `(0.5,0)`
- `uvToStage(u,v, transform)` with SVG `matrix(a b c d tx ty)`
- `lengthScaleTowardTip` keeps root fixed; longer lengths extend toward tip only
- **Do not** use legacy `nailScale()` / `PX_PER_MM` for this plate
