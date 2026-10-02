# Helio city-map release — public QA

Public site: [Helio](https://moyisey.github.io/helio/). Source: [MOYISEY/helio](https://github.com/MOYISEY/helio).

## Exact runtime and deployment

The frozen runtime is commit [`e2194f8f03fa7d48bf74d7697b30d933685d378b`](https://github.com/MOYISEY/helio/commit/e2194f8f03fa7d48bf74d7697b30d933685d378b), deployed by [Pages workflow37030025535](https://github.com/MOYISEY/helio/actions/runs/37030025535). GitHub reported the build complete at **2026-10-02T15:54:42Z** and workflow success at15:55:01Z. Entry `index-JU_mGNCl.js`, map chunk `MapPanel-rSv63p_v.js`, CSS `index-_qQQm9al.css`.

After Pages reported built, the implementation reviewer fetched **all21 production files** (HTML, JS, CSS, worker, fonts and license notices; excluding only `.nojekyll`) from the public host and compared SHA-256 with the local production build: **21/21 identical**. [Runtime byte evidence](runtime-public-final.json), [runtime deployment evidence](deployment-runtime.json). An earlier probe while Pages was still building saw old HTML/new-asset404s; it was not accepted as deployment validation. Later report/screenshot commits do not change these runtime files.

## Three independent audit rounds

1. [Code, correctness, geometry and security](audit-map-code.md), with [machine evidence](map-code-results.json): **37/37 tests**, the unchanged15 solar tests and22 map tests. Fixes cover early input limits, linear deduplication, stable-ID fragments, courtyard holes, local clipping, date-line bounds, conservative invalid/incomplete states, actual raycasting and low-sun/tall-roof shadow-camera bounds. A real production-extrusion fixture verifies the8,192-point cap bounds position buffers below100,000 vertices. Production dependency advisory check:0 reported vulnerabilities. The final paint-only follow-up executed14 allowed paint operations, preserving sources, geometry and attribution; TypeScript passed.
2. [Design, accessibility and performance](audit-map-design.md), with [machine evidence](map-design-checks.json): **125 assertions** on the preceding stable candidate, followed by **34/34 targeted assertions on the frozen final candidate**. Ten RU/EN viewport cases covered320/360/390/768/1440; targeted200% text, reduced motion, first-screen CTA, keyboard controls and fault paths were exercised. Selected axe rules found0 violations. Actual instrumentation found0 idle/time-change provider requests and0 idle/offscreen draws after the visibility fix. Draw calls are not FPS. The final paired08/18 screenshots were visually inspected, marker26px retains its44px target, attribution fits.
3. [Independent final public regression](audit-map-final.md), with [machine evidence](map-final-checks.json): **21/21 directed groups at1440 and21/21 at390**, plus **8/8 isolated fault scenarios**, on the exact final entry. Every browser HTML was checked against that entry. Actual city contours, changes of sunlight, marker drag, canvas click, keyboard centre, all available event buttons, pitch/zoom/north, cancellation/remount, save/restore/delete, DST, JSON/ICS and horizon controls were used. The fault cases cover corrupt/blocked storage, blocked provider, one failed building tile amid successful tiles with sticky unavailable state and successful Retry recovery, actual context loss, no WebGL, a skipped civil date and latitude beyond map projection.

These map audits are separate from the historical open-horizon reports. No unexecuted browser, video, device or screen-reader check is claimed.

## Additional directed public interaction check

The implementation reviewer separately reran [`qa-map-regression.mjs`](../scripts/qa-map-regression.mjs) on the final public runtime: **20/20 groups at1440,20/20 at390; no-WebGL and blocked-provider scenarios passed**. [Saved result](map-directed-public-final.json). The sequence clicked real public controls and used keyboard/pointer input. It includes bilingual local city search, unknown-city recovery, actual134-part complete model, visible linked attribution,08/12/18 sunlight, both timelines, keyboard range, night, pitch/north/zoom, centre/canvas/marker selection, every available solar-event button, four horizon headings/follow/2D/3D, languages, date forward/back/Now, explicit save/restore/delete, actual downloaded JSON/ICS files, invalid coordinates/zones, Kathmandu offset, repeated DST hours and polar night. Page errors:0. Time changes retained geometry and requested no new building tiles.

These are directed Playwright interactions in native Chromium, followed by screenshot inspection. They are not claimed as a human hand-operated browser session, a physical mobile test or native Safari certification. The parent independently reviewed the no-WebGL live path through its cloud browser; that browser cannot supply evidence of the native3D map.

## Paired actual public GPU captures

Captured from runtime `e2194f8…` on **NVIDIA GeForce RTX3050 Laptop GPU / ANGLE Direct3D11, actual WebGL2**. Each viewport builds the London block once; only local solar time changes between08:00 and18:00 on2026-06-21. Both views retain **134 parts /1,358 contour points,0 skipped, complete model**, without fallback or page errors. Readouts:08:00 UTC+01:00, altitude27.0°/azimuth86°;18:00 UTC+01:00, altitude27.7°/azimuth274°. The implementation reviewer opened and inspected all four panel images: changing blue ground shadows, building volumes, marker, attribution and local time are visible.

| Viewport | Morning08:00 | Evening18:00 |
| --- | --- | --- |
| Desktop1440×1000, map + panel | [Morning](screenshots-map-final/desktop-morning-panel.png) | [Evening](screenshots-map-final/desktop-evening-panel.png) |
| Mobile390×844, map + time | [Morning](screenshots-map-final/mobile-morning-panel.png) | [Evening](screenshots-map-final/mobile-evening-panel.png) |
| Desktop map crop | [Morning](screenshots-map-final/desktop-morning-map.png) | [Evening](screenshots-map-final/desktop-evening-map.png) |
| Mobile map crop | [Morning](screenshots-map-final/mobile-morning-map.png) | [Evening](screenshots-map-final/mobile-evening-map.png) |

[Capture manifest and exact SHA-256](screenshots-map-final/manifest.json). Immutable screenshot publication: [`ecd774d93f51cc00eaf5c05533cf7c01e77d0977`](https://github.com/MOYISEY/helio/commit/ecd774d93f51cc00eaf5c05533cf7c01e77d0977). The script uses normal provider viewport loading and persists rendered screenshots, never raw map tiles, HAR or building GeoJSON. Screenshots are evidence rather than a GPU benchmark.

## Practical limits

All building heights are cartographic estimates, including valid provider numbers. Only loaded buildings within the300×300m model are considered, with flat ground and a1.6m point ray; no terrain, trees, weather or outside obstacles. Missing/invalid data and processing limits yield insufficient data; a clear ray does not guarantee observed sunlight. Low-angle shadows can extend beyond the model. The map uses disclosed OpenFreeMap/CDN requests and depends on provider availability. Search is a local nine-city list, not address search; moving a point retains the explicit IANA zone. Some dashed model edges can crop at the enlarged mobile framing.

Mobile tests emulate CSS viewport/touch. Physical phones, installed Safari, assistive-technology sessions, FPS/battery measurements and ideal pixel-shadow agreement were not tested. Earlier Firefox/WebKit results apply to the baseline release and are not promoted into final-map claims. Solar primary-repository fixtures are preserved rather than presented as fresh USNO network queries. The Windows implementation reviewer did not view the reference videos; the parent and separate visual reviewer did, under an explicit waiver after the Library compatibility issue.
