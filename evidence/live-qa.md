# Public live QA — Helio

Target: https://moyisey.github.io/helio/. Final browser retest 2026-10-02T14:04:48.435Z. This is directed real-browser clicking and native screenshot inspection, not a claim of physical phone or screen-reader testing.

## Executed scope

- 20 final matrix scenarios passed:360/390/768/1440 × RU/EN × daytime/nighttime, plus explicit2D, reduced motion, disabled WebGL and200% computed-text stress. Final axe WCAG A/AA findings:0; page errors:0; unexpected third-party requests:0.
-16 actual interaction groups passed at each of390 and1440: keyboard skip/scrubber; all seven event jumps; N/E/S/W/follow;2D↔3D; both language directions; previous/next/now; all nine cities; both distinct DST01:30 instants; explicit save/restore/delete; real JSON/ICS downloads; manual coordinate and zone errors with recovery; polar night/twilight; actual GitHub source popup with null opener; brand home.
- Firefox155 and Playwright WebKit26.6 final public engine probes passed: mobile390 layout, spring-DST23-hour slider, time change and no page errors. Chromium performed the full matrix/action scope. Installed Safari and physical devices were not tested.
- The first public run had five navigation/networkidle deadlines, one GitHub popup load deadline and a WebKit networkidle deadline. Their full original evidence is retained in previousAttempts. Only these failed checks were rerun with explicit DOM/UI/WebGL readiness and completed successfully. This is not an uninterrupted first-pass claim. Local sandbox initially prevented GitHub navigation and Firefox page setup; the authorized public read-only run succeeded outside that restriction.

Compact raw result: [live-checks.json](./live-checks.json). Reproduce with node scripts/qa-public.mjs <URL> <private-output-directory>; --retry-failed preserves earlier failures when retrying.

## Actual public3D captures

[Desktop1440×1000](screenshots/desktop-3d.png) and [mobile390×844](screenshots/mobile-3d.png) were captured2026-10-02T13:56Z from the live a7f1b7d implementation, with WebGL2 active, fallback=false and zero page errors. [Manifest](screenshots/manifest.json) records actual renderer, buffer dimensions, timestamps and SHA-256. The parent personally inspected the2D fallback and has these real3D captures for separate visual acceptance; its2D inspection is not described as a3D inspection.

The PNG/manifest paths were verified through the official GitHub contents API at immutable evidence commit9ca8a6f58c41d697208f4718de0494c0b82630a3; remote bytes match the captured files. A separate direct raw-download attempt timed out, so it is not claimed as a successful verification.

## Numerical and design audits

[Numerical/security audit](audit-numerical.md):15 unit tests and15 runtime checks passed;768 published USNO-event comparisons max33.002s,728 JPL positions max0.026329° azimuth/0.170590° apparent altitude. Primary-repository oracle data were used because direct current USNO access was unavailable.

[Design/accessibility/performance audit](audit-design.md):11 broad scenarios,4 targeted fixes and66 interaction assertions passed. DPR1.5 cap, zero idle/offscreen rendering and reduced-motion behavior measured; this is draw-call evidence, not an FPS or battery benchmark.

Final deployment identity and every public runtime-file hash are checked separately after the final evidence commit; the exact commit/build record is returned in the final handoff. Artistic scene scale is not scientific pixel-angle calibration. There is no weather/terrain/illumination guarantee.
