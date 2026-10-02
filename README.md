# Helio / Daylight Atlas

[Open Helio](https://moyisey.github.io/helio/) · [Source](https://github.com/MOYISEY/helio)

A daylight planner with an interactive city map and a bounded model of building shadows. React, TypeScript, MapLibre and Three.js. Search a local list of nine cities, then select a street or courtyard by clicking, dragging the marker, or using the keyboard and “Use map centre”. Moving the point preserves the explicitly selected IANA zone; check it when changing regions.

“Build this neighborhood” reads contours from already loaded OpenFreeMap vector tiles and constructs a 300 × 300 m Three.js model. Directional light casts actual shadow maps. Moving the local-day timeline updates light and tests a ray from the point at 1.6 m height against the same meshes. It does not rebuild or request buildings again. The open-horizon world and its 2D panorama remain an additional mode.

## Run and build

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview -- --port 5176
```

The committed docs build is served free by GitHub Pages from main, with Vite base /helio/. Tests use Node 24 native TypeScript stripping. Browser QA uses Playwright and its browsers or PLAYWRIGHT_BROWSERS_PATH / PLAYWRIGHT_BROWSER_EXECUTABLE_PATH.

## Building model and limitations

The production style is inspected through map.getStyle() before choosing the vector building source. At implementation time, [Liberty](https://tiles.openfreemap.org/styles/liberty) uses source openmaptiles, source-layer building and render_height, render_min_height, hide_3d. [TileJSON](https://tiles.openfreemap.org/planet) describes OpenMapTiles 3.16.0, building tiles at zooms 13–14. querySourceFeatures returns clipped pieces and duplicates from loaded viewport tiles, not a complete inventory of surrounding obstacles.

Stable-ID fragments with matching height/base are unioned, preserving holes and MultiPolygons. Without an ID, exact geometric duplicates are removed conservatively. Polygons are clipped to the visible dashed 300 m boundary. Hidden 3D contours are excluded. Input, vertex and part budgets produce explicit incompleteness, never a silent clear result.

The final contour cap is 8,192 closed points, bounding actual nonindexed building position buffers to 98,304 vertices plus a four-position ground receiver. The 240-part cap remains. Cream roof caps, darker walls, cold-blue cast shadows and a quieter basemap distinguish the model without changing geometry. The 26 px marker retains a 44 × 44 px touch target.

**Every live-map height is a cartographic estimate.** Render heights may be generated and their original provenance is unavailable. Invalid or missing values use conditional 9 m height / 0 m base and are counted in the UI. Heights are never labelled measured or verified. Flat ground, loaded buildings only: trees, weather, actual terrain, missing buildings and obstacles outside the boundary are excluded. No footprints means insufficient data, not an empty street.

Point states: sun below horizon; point inside a building (choose outside); shadow from a loaded building; loaded buildings do not block the sun; insufficient data. A clear ray is **not a sunlight guarantee**. Low sun has a prominent warning: a 100 m building at 10° casts a shadow about 567 m long, beyond this model. Ordinary fill extrusions are hidden and are not presented as casting shadows.

Local east/up/south is transformed into Mercator east/south/up; the validated solar direction is shared. Meshes, materials and shadow maps are disposed when the model changes. WebGL failure keeps city search and solar calculations with an honest unavailable message. Near ±85° latitude the map projection ends; solar calculations retain the exact coordinates.

## Solar calculation contract

[SunCalc 2.1.0](https://github.com/mourner/suncalc/tree/v2.1.0) uses degrees, azimuth clockwise from north and apparent altitude. Helio inverts refraction for geometric phase thresholds; displayed apparent position stays unchanged. Sunrise/set use −0.833°, civil twilight −6° to −0.833°, golden light −0.833° to +6°. High-latitude windows can exceed an hour or fill a day. Missing crossings stay absent; polar day/night and winter twilight remain distinct.

Temporal resolves actual IANA day boundaries, including 23/25-hour days and skipped dates. The slider uses elapsed minutes, with UTC offsets distinguishing repeated hours. Display rounds to minutes; JSON retains unrounded UTC instants and ICS creates a thirty-minute appointment. Solar event times are for an open horizon and standard refraction, separate from the building ray test. See [USNO definitions](https://aa.usno.navy.mil/faq/RST_defs).

Date range 1900–2100. Coordinates require finite ±90° latitude / ±180° longitude and explicit valid zone. URL settings city, zone, date, time, lang, view=2d recover invalid values with feedback; ambiguous/gap wall times are rejected. Coordinates are not inserted in generated URLs.

## Map provider and privacy

[OpenFreeMap](https://openfreemap.org/quick_start/) and its CDN serve the map without keys or accounts, with visible linked OpenFreeMap, [OpenMapTiles](https://www.openmaptiles.org/) and [OpenStreetMap](https://www.openstreetmap.org/copyright) attribution. Requests reveal the viewed tile area and ordinary network information to the external provider/CDN. Read its [privacy policy](https://openfreemap.org/privacy/) and [terms](https://openfreemap.org/tos/). The service has no availability guarantee.

Ordinary interactive viewport loading only. No Overpass, Nominatim, external geocoder, scraping, offline tile collection or automatic map-data snapshots. City search is a local nine-city list, not address search. Network failure preserves the selected point and solar plan and reports unavailable map/building data.

A failed source tile prevents the partial neighborhood from being treated as complete, including after time changes. “Retry map” remounts the map and retains the selected point, date and time. Rendering is suspended offscreen and in a hidden document; returning to view uses the latest solar position.

Solar calculations are local. No automatic storage, analytics, geolocation or server. Application runtime/fonts are self-hosted. Save uses only the explicit helio.saved-plan.v1 action, with separate restore/delete. User-triggered JSON/ICS downloads include coordinates and zone. Source/provider links are explicit external navigation.

## Evidence and access

[Map audit 1: code, geometry and security](evidence/audit-map-code.md), [map audit 2: design, accessibility and performance](evidence/audit-map-design.md), [map audit 3: independent public regression](evidence/audit-map-final.md), and [public directed QA / paired GPU screenshots](evidence/live-map-qa.md) describe the city-map release and their exact scope.

[Baseline numerical audit](evidence/audit-numerical.md), [baseline design audit](evidence/audit-design.md) and [baseline live QA](evidence/live-qa.md) document the earlier open-horizon release. They are not substituted for the later map audits.

Primary-repository USNO/JPL fixtures are used because the direct current USNO API was unavailable. Browser viewport/touch tests are not physical phones or installed Safari; axe is not screen-reader certification. Reduced motion removes camera easing, DPR is capped at 1.5 and the custom layer renders only for updates.

The authored open-horizon world has an artistic scale, not scientific pixel-angle calibration; no copied scene assets. The parent and separate visual reviewer viewed the reference videos. The Windows worker did not view them after a Library helper compatibility issue and explicit waiver.

Full runtime/font licenses are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and the public build.
