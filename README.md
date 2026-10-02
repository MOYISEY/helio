# Helio / Daylight Atlas

[Open Helio](https://moyisey.github.io/helio/) · [Numerical audit](evidence/audit-numerical.md) · [Design audit](evidence/audit-design.md) · [Live QA](evidence/live-qa.md)

An original sunlight planner for a photograph or a walk. React, TypeScript and a custom Three.js world; no account, weather, terrain, map, geolocation, API key or analytics.

Choose a curated city or coordinates, a calendar date and an explicit IANA time zone. Scrub the actual local day, jump to solar events, follow the sun or look north/east/south/west. Download a JSON plan or a thirty-minute UTC calendar appointment at the selected instant. Device saving happens only through the save button.

## Run and build

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview -- --port 5176
```

The committed `docs/` build is served free by GitHub Pages from `main`. Vite uses `/helio/` as its base. Tests run with Node 24 native TypeScript stripping. Browser QA uses Playwright; install its browsers or set `PLAYWRIGHT_BROWSERS_PATH` / `PLAYWRIGHT_BROWSER_EXECUTABLE_PATH`.

## Calculation contract

Pinned [SunCalc 2.1.0](https://github.com/mourner/suncalc/tree/v2.1.0) returns angles in degrees, clockwise azimuth from north and apparent, refraction-corrected altitude. Event thresholds are geometric. Helio inverts the engine's refraction formula before phase classification; the displayed apparent position remains unchanged.

- Sunrise/set: standard upper-limb crossing at −0.833° geometric altitude, level unobstructed horizon and observer height 0m.
- Civil twilight: −6° to −0.833°.
- Golden light: −0.833° to +6°; normally sunrise→+6° and +6°→sunset. At high latitudes the interval may last beyond an hour or fill a civil day. Missing +6° crossings do not imply missing sunrise.
- Ordinary daylight, polar daylight, polar night and possible winter civil twilight remain distinct. Missing events stay absent, with disabled event buttons and no fabricated midnight.
- A selected calendar date is separate from its UTC instant. Temporal resolves true IANA day boundaries, including 23/25-hour days. Events are collected from adjacent solar days, deduplicated and filtered to those actual bounds.
- The slider uses elapsed minutes. Each clock and event uses the selected zone; UTC offsets distinguish repeated hours. Display rounds to the nearest minute. Exports retain unrounded UTC instants.
- Optional URL parameters: `city`, `zone`, `date`, `time`, `lang`, `view=2d`. Invalid settings recover with feedback. Gap and ambiguous DST wall times in URLs are rejected; use the elapsed slider to choose a specific repeated instant. Coordinates are never put into generated URLs.
- Date range: 1900–2100. Calendar dates skipped by a zone change are rejected. Manual coordinates require finite latitude ±90 and longitude ±180 and a valid IANA zone.

These are open-horizon estimates under ordinary refraction, not weather or illumination guarantees. Buildings, mountains and cloud conditions are outside the model. [USNO definitions](https://aa.usno.navy.mil/faq/RST_defs) describe the astronomical convention.

## Original visual world and access

The world uses authored sphere geometry, atmosphere/sky shaders and seeded stars; it contains no copied reference assets or real terrain. Sun direction and lighting use the calculated north-clockwise world vector. The camera may follow the sun or use cardinal headings. The finite scene scale is artistic; this is not a scientific pixel-angle calibration or a sky map.

The 2D panorama uses the same solar position. WebGL/context or renderer import failure falls back to it. Reduced motion removes camera easing; DPR is capped at1.5. Rendering occurs on demand and stops offscreen or in a hidden tab. No mandatory intro, sound or scroll interception.

The parent and a separate visual reviewer inspected the supplied reference videos. The Windows implementation worker did not view them; duplicate Windows transfer was explicitly waived after the current Library helper's Windows xattr incompatibility.

## Privacy and data

All calculations and coordinates stay in the browser. There is no automatic storage, telemetry or network API. Explicit saving uses the single `helio.saved-plan.v1` localStorage key; restore/delete are separate actions. JSON/ICS file export is initiated by the user and includes the chosen coordinates and zone. Fonts and runtime code are self-hosted. The source link opens GitHub only when clicked.

## Evidence and limits

Two independent Codex audits review numerical/correctness/security and design/accessibility/performance. The final public deployment and directed desktop/mobile browser interactions are checked separately. Reports distinguish actual executed checks from limitations; Playwright viewport/touch tests are not physical phones or installed Safari, and axe is not a screen-reader audit.

Published primary-repository USNO/JPL reference fixtures are used because the direct current USNO API was unavailable. No client metric, real weather accuracy or exact on-device physical observation is claimed.

Third-party runtime/font copyright and complete license texts are preserved in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and distributed with the public build.

