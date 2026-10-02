# Independent design, accessibility and performance audit

Reviewer: delegated Codex design audit agent. Product source was not edited by this reviewer. Reference videos were viewed by the parent and a separate visual reviewer; this audit reviewed the supplied brief and Helio itself.

## Initial visual checkpoint — 2026-10-02

Target: local prototype at `http://127.0.0.1:5175/helio/`, initial source HEAD `f707085953ec03279730eb410b059209e780b5ad`. This checkpoint precedes the numerical planner and complete control implementation; it is not a final-product acceptance report.

Real Chromium screenshots inspected: Russian 360, 390, 768 and 1440 px; English daytime 1440 px; English 2D 390 px; Russian nighttime 390 px. Screenshots and machine reports are kept in ignored `qa-private/design-audit/`; no screenshot assets are part of the product.

The editorial composition, restrained cobalt/cream/amber palette and large near planetary horizon are coherent. Mobile uses its own vertical sequence: heading, atmosphere/readout, planner, footer. There is no horizontal document overflow at the four requested widths. The scene is original procedural geometry/shaders; the audit did not compare source video frames.

### Initial findings requiring resolution

1. **High — contrast on the scene-mode toggle.** In 2D and simulated no-WebGL mobile scenarios, `.scene-caption > button` falls over the pale sun. Axe measures **1.2:1** for cream text on `#ffd29b`, below 4.5:1. Use an opaque dark surface, then retest day/night and both renderers.
2. **Medium — document language stays Russian.** Switching to the English UI leaves `<html lang="ru">`; screen readers can pronounce English incorrectly. Update document language alongside the visible UI.
3. **Medium — small labels and copy crossing the luminous sky.** Several mobile labels/caption/footer elements are 7–10 px. At 768 px, the intro overlaps the warm bloom. Automated canvas contrast results cannot prove the contrast of text over arbitrary WebGL pixels. Increase functional label size and make the important overlay text contrast stable across sunlight positions.
4. **Functional scene follow-up — azimuth is unused in the prototype.** `Scene.tsx` computes `yaw` and discards it (`void yaw`). The scene tracks altitude while remaining centered, whereas 2D maps azimuth. Final scene direction and the 2D projection must have a consistent, explained compass convention; numerical audit owns correctness.
5. **Visual polish — sun reads as a dark dot within an oversized halo at sunset.** This comes from a pale mesh against a brighter shader glow. Review sun/bloom balance before final acceptance.
6. **High — text enlargement overlaps and clips content.** A corrected 200% text-size stress test (all computed font sizes doubled; not a native browser-zoom claim) at 390 px shows the long first headline clipped by `main{overflow:hidden}`, the absolutely positioned clock overlapping headline/intro, and the date text clipped inside its narrow control. `scrollWidth` alone misses this because clipping suppresses overflow. The final layout needs flow-based readout placement when text grows and controls that can stack. Captures: `ru-200percent-mobile.png` and `ru-200percent-desktop.png`.

### Initial measured scope

- Prototype scenarios: 360/390/768/1440, English day, Russian night, explicit 2D, reduced motion, simulated no-WebGL, corrected 200% text-size stress tests at 390 and 1440 px. The original body-only font-size attempt was discarded because fixed pixel font sizes were unchanged.
- No JavaScript page errors in the first ten scenarios. WebGL construction under deliberately disabled WebGL can emit an expected Three.js console diagnostic; the functional 2D fallback still appeared.
- Automated WCAG A/AA axe checks: no reported violations except the identified scene-mode contrast in 2D/no-WebGL. This does not cover visual canvas contrast or a complete accessibility conformance claim.
- Runtime WebGL draw-call instrumentation at device DPR 3 measured a 1029×795 drawing buffer for a 686.375×530 CSS canvas (effective DPR 1.5). After the introduction, **0 draws during 700 ms idle**, **4 draws on a scrubber state change**, **0 draws while the scene was programmatically moved offscreen**, and **4 draws when returned**. Reduced motion produced 30 initial draw calls versus 220 with the introduction, then the same zero-idle/offscreen behavior. This is draw-call evidence, not a frame-rate benchmark. Detailed ignored evidence: `render-report.json` and `qa-private/render-audit.mjs`. The source also disposes Three.js resources and observes visibility.
- This checkpoint does not claim final action, exports, local saves, independent numerical fixtures, public deployment, or live QA.

Final-product audit and resolution evidence will be appended after implementation is ready.

## Final implementation review — local working tree, 2026-10-02

Target: isolated audit dev server `http://127.0.0.1:5182/helio/`. This phase reviewed the implemented planner in the working tree, before the final commit/public deployment. The parent owns deploy verification and independent source-video comparison.

### Confirmed resolutions

- The scene-mode toggle and caption have dark opaque surfaces; the prior 1.2:1 fallback toggle failure no longer occurs.
- Russian/English changes now update document language. Functional labels are generally 11–14 px.
- Desktop composition uses a grid; mobile readout is in normal flow. Enlarged headline text wraps instead of clipping, and the clock no longer overlaps the intro.
- Scene code now uses shared north-clockwise solar direction in world coordinates and corrected world-space planet normals. Follow-sun and fixed N/E/S/W controls provide keyboard-accessible camera directions.
- The previously hidden globe was restored by constraining scene height independently of the growing planner. Actual updated 768/1440 screenshots show the large near horizon. The smaller warm bloom and bright sun disk resolve the earlier dark-dot appearance.

### Measured final scope so far

- **11 automated accessibility/viewport scenarios passed** with zero axe WCAG A/AA findings, zero JavaScript page errors, and zero horizontal document overflow: 360/390/768/1440, English daytime, Russian nighttime, explicit 2D, reduced motion, simulated no-WebGL, 200% text-size stress at 390/1440. Automated results do not establish full accessibility conformance or canvas-pixel contrast.
- **66 browser interaction assertions passed**: 33 each at 390 and 1440. Actual clicks/keyboard operations covered time scrubbing, keyboard north camera, all fixed compass directions and follow reset, seven event jumps, adjacent days, now in the chosen zone, invalid zone/coordinates with recovery, a valid Kathmandu location, explicit local save/restore/delete, renderer switching and both language directions. JSON/ICS were actually downloaded and checked; source-link target/opener protection was checked without claiming a clicked GitHub navigation.
- Fresh contexts had no automatic localStorage entry. No unexpected third-party requests or JavaScript page errors occurred in the interaction runs.
- Final draw instrumentation at device DPR 3: 1029×660 buffer for a 686.375×440 CSS canvas, effective DPR 1.5; **0 draw calls in 700 ms idle**; a short normal camera transition produced **116 draw calls**, reduced motion produced **4**; **0 while programmatically offscreen**, **4 on visible return**. These are draw-call counts, not a device FPS or battery benchmark.
- Ignored evidence: `qa-private/design-final/report.json`, `interaction-report.json`, actual exported `plan-390/1440.json` and `.ics`, `render-report.json`, `visual-report.json`, native viewport and full-page captures. Playwright control filling can scroll automatically; final composition captures use the URL time and an explicit instant scroll to zero, rather than treating a scrolled viewport as the initial view.

### Remaining findings sent for correction

1. **Medium — 200% text clips the mobile language button.** At 390 px, the header language button spans x=368.86…408.86, so roughly 19 px are outside the viewport. `main{overflow:hidden}` hides this without document overflow. Allow the header to wrap/recompose; verify the control remains fully visible and reachable.
2. **Medium — mobile fallback crops the azimuth panorama.** At 390 px and solar azimuth 263°, the sun disk is clipped at the right edge and only the S compass label remains visible. The overscanned 3D world and sliced SVG crop the 2D projection. Use a full-width schematic projection for fallback and contain SVG overflow, then verify all compass marks and the selected sun are visible.

The report remains open until these two findings have been retested. Public live QA is not claimed by this phase.
