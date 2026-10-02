# Independent numerical, correctness and security audit

Reviewer: delegated Codex numerical audit agent. This reviewer wrote independent tests and reference fixtures, but did not edit product source, publish, or change Git.

## Reference provenance

Pinned installed engine: SunCalc **2.1.0**. Its source and documentation define apparent, refraction-corrected altitude in degrees, and azimuth clockwise from north. Its event thresholds are geometric: sunrise/set -0.833 degrees, civil dawn/dusk -6 degrees, and golden-hour crossings +6 degrees. Helio explicitly inverts the installed engine's refraction before classifying geometric light intervals.

The direct official USNO `oneday` API request failed with `ECONNRESET`; web reads also failed. Consequently this audit uses the **published USNO-derived and JPL Horizons reference data** in the primary SunCalc repository's `v2.1.0` tag, not a freshly fetched USNO response and not expectations computed by Helio or SunCalc.

- [Reference fixture](https://github.com/mourner/suncalc/blob/v2.1.0/test/fixtures.json), generated 2026-06-17T17:39:51.096Z. Downloaded source SHA-256: `87abcce41e0a6aafdb00930a0d99627d066eeeb0fde2381d2868b8d9bd682e03`.
- [Collection provenance](https://github.com/mourner/suncalc/blob/v2.1.0/test/fetch-truth.js) documents official USNO UTC rise/set/civil-twilight/transit records and refracted JPL Horizons solar positions.
- [USNO definitions](https://aa.usno.navy.mil/faq/RST_defs): ordinary level unobstructed horizon, standard atmospheric assumptions. Real weather, terrain and observed illumination are not validated or predicted.
- Checked-in reduced solar-only records: `tests/fixtures/usno-solar.json` and `tests/fixtures/jpl-solar.json`. Original downloaded files, provenance hashes and full comparisons remain in ignored `qa-private/numerical-reference/`.

## Executed first pass — 2026-10-02T13:18Z

Command: `node --experimental-strip-types --test tests/numerical-audit.test.ts`.

- **768 USNO-derived solar-event comparisons**, covering 14 locations and 13 dates, all within the two-minute acceptance threshold. Maximum error: **33.002 seconds**.
- One explicitly treated whole-minute boundary record: Lima 2026-01-03 dusk `00:00` corresponds to computed 2026-01-02T23:59:54.352Z. Helio correctly excludes that exact instant from the next civil day. The test allows this previous-day rounding case only within 30 seconds of midnight; it does not relax ordinary-date filtering.
- **728 JPL-derived position comparisons**: maximum clockwise-north azimuth error **0.026329 degrees**, maximum apparent-altitude error **0.170590 degrees**. Tolerances 0.05/0.25 degrees.
- Passed: New York spring/fall 23/25-hour days; Sydney 25/23-hour days; leap day; Kathmandu +05:45; Kiritimati +14 date line; skipped Apia date rejection; duplicate DST hour with separate offsets; Tromsø polar day/night, winter civil twilight, low sun with no +6 crossing, and preceding-solar-day sunset recovery; full interval coverage and selected-date event filtering for 72 city/date combinations; inverse refraction; north/east/south/west unit vectors; invalid inputs/saved-state rejection; JSON exports; UTC calendar times, UTF-8 line folding and standard escaped characters.
- **15 tests, 12 passed, 3 failed**. The three failures are concrete findings below, awaiting source fixes and regression rerun. This is not final acceptance.
- Production dependency command `npm audit --omit=dev --json` completed successfully: **0 reported production vulnerabilities** (10 production dependencies). This is an advisory-database result, not a claim that all dependencies are vulnerability-free.

## Findings identified in the first pass

1. **Medium — default date uses the zone before URL override.** With current instant 2026-10-02T12:00Z and `?zone=Pacific/Kiritimati`, `initialSettings()` selects 2026-10-02 even though today in the final selected zone is 2026-10-03. Recompute the default date after all location/zone selections.
2. **Medium — nonexistent DST wall time silently changes.** `?city=new-york&date=2026-03-08&time=02:30` resolves to 07:30Z / 03:30 EDT with `error:false`. Show recoverable feedback when the resolved wall time differs from the requested time, and explain the policy for repeated times. Distinct repeated instants remain available through the elapsed-day scrubber.
3. **Low — lone carriage returns survive ICS escaping.** A locally supplied place name `A\rBEGIN:VEVENT\rSUMMARY:injected` creates bare CR characters in the exported `SUMMARY`. Escape CRLF, standalone CR and standalone LF before RFC folding. This is local calendar content integrity; no server-side execution was demonstrated.

## Verified resolutions and final local audit

All three source findings were fixed by the implementation agent and independently rerun: **15 tests, 15 passed, 0 failed**. The default date now follows the final zone; `Temporal.ZonedDateTime.from` with `disambiguation: 'reject'` rejects ambiguous/nonexistent URL wall times with recovery feedback; ICS escaping now handles CRLF, standalone CR and standalone LF. The elapsed-day scrubber still reaches both distinct repeated-hour instants and displays their UTC offsets.

Command: `node scripts/audit-runtime.mjs http://127.0.0.1:5177/helio/`. A separate current-source preview was used after a temporary Windows transport interruption terminated the previous dev server. Failed connection attempts are not counted as successful browser checks.

The final local Chromium runtime audit executed **15 checks, all passed**:

- A 25-hour New York fall-DST day exposes both `01:30` instants: 05:30Z / UTC-04:00 and 06:30Z / UTC-05:00.
- Actual JSON and ICS downloads were saved and read back; selected absolute instant, local date, IANA zone, day duration, UTC calendar start and 30-minute end match the current plan.
- All seven available event buttons jump to their exact calculated instants.
- Save, next day, restore and delete work; there is no automatic write and exactly one explicit save writes the local plan. Malformed stored JSON and denied storage give recoverable feedback.
- Invalid IANA-zone input preserves the existing valid plan. Manual coordinates reject latitude 91, then accept the tested Tromsø coordinates and explicit Oslo zone. Coordinates are not put into the page URL or any outgoing request.
- Tromsø polar night disables absent sunrise, retains civil dawn and twilight, and allows a dawn jump. Now and previous/next day work within the elapsed range.
- All four 3D compass-heading buttons, follow-sun mode, 3D/2D switching and Russian/English switching respond. Language changes the document `lang` and preserves the selected instant. Both renderers use `positionAt`; the 3D source uses the tested clockwise-north `solarDirection`.
- Captured runtime requests are all same-origin, including local fonts and the lazy 3D module. No third-party request, automatic location request, telemetry call or coordinate transfer occurred during these flows. The intentionally external GitHub source link was not clicked as part of this network assertion.
- Malformed URL parameters and the nonexistent DST URL time show feedback and retain a usable plan. No JavaScript page errors occurred in the executed flows.

Source review found no application `fetch`, XHR, geolocation, beacon, WebSocket, dynamic HTML injection or `eval` calls. The only external product link is the GitHub source link with `noopener noreferrer`. The initial storage read only determines whether a saved plan exists; writes/removal occur in explicit button handlers. `THIRD_PARTY_NOTICES.txt` is present; downloaded primary reference source files are kept out of publication.

Machine summary: `evidence/numerical-results.json`. Full request/action reports, saved exports and source hashes: ignored `qa-private/numerical-runtime/` and `qa-private/numerical-reference/`. Unit tests and reduced provenance-bearing reference fixtures are checked in for reproducibility.

## Scope limits

This reviewer completed local current-source Chromium numerical/correctness/privacy QA. It did **not** audit the public deployment, compare the original Library videos, certify accessibility, or calibrate the artistic scene as a scientific pixel-angle plot. The world sun vector and shared calculations were verified; camera/world scale remains artistic as stated in the UI. The independent design reviewer owns rendering/accessibility/performance scope, and the implementation agent owns final public live regression after deployment. Real weather, terrain, atmospheric variation and observed photographic illumination remain outside Helio's estimate.
