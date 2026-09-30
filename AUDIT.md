# Code Audit

Tick an item when it lands, and note the commit next to it.

- P0: broken today, the behaviour is wrong.
- P1: misleading today, users or contributors will get it wrong.
- P2: inconsistent with siblings or other layers, or costly to change.
- P3: polish, duplication, dead code.

Audited 2026-09-26 at `967bbb6`. Read all first-party library, native, example, test, and tooling source; excluded vendored encoders, generated bindings/fixtures, dependencies, and build output. Verification used isolated Bun/React probes and a host C++ probe against the current source. No device or release gates were run for this tracker-only audit.

## P0: Broken

- [ ] 1. **Web ignores a non-fixed QR version range.** `packages/react-native-nitro-qrcode/src/index.web.ts:589` passes a version only when `minVersion === maxVersion`; `getMatrix({value: "hello", minVersion: 10, maxVersion: 12, boostEcl: false})` returns version 1, while 100 lowercase `a` characters with range 1–2 return version 6 instead of rejecting overflow. **Extract Function** for bounded version selection, enforce both limits, and align the copied selection in `scripts/generate-parity-corpus.js:72` with that contract.
- [ ] 2. **Web error-correction boosting skips M.** The candidate loop at `packages/react-native-nitro-qrcode/src/index.web.ts:562` tries only Q and H, so a version-1 payload of twelve lowercase `a` characters requested at L remains L even though M fits. The fixture generator repeats the same loop at `scripts/generate-parity-corpus.js:76`, so its expected output can repeat the defect. **Substitute Algorithm** with the ordered levels above the requested level, including M, and add an independent L-to-M case.
- [ ] 3. **A partial component shape override erases the remaining preset.** `stableShapeOptions` at `packages/react-native-nitro-qrcode/src/qrcode-component.ts:278` materializes every property, including undefined ones; `mergePresetShapeOptions` at `packages/react-native-nitro-qrcode/src/defaults.ts:118` spreads them over the preset. A React probe with `preset="rounded"` and `shapeOptions={{gap: 1}}` produces undefined shapes and radii instead of the rounded defaults. **Extract Function** to merge only defined overrides before scaling, while retaining value-based memoization.
- [ ] 4. **The web square-run shortcut drops supported shape options.** `canDrawSquareRuns` at `packages/react-native-nitro-qrcode/src/index.web.ts:671` omits alignment/timing shapes and corner radii; both PNG paths use it at lines 219 and 279. A version-2 QR with only `alignmentShape: "circle"` draws no ellipses, but adding an unrelated stroke color disables the shortcut and draws 17. **Consolidate Conditional Expression** into a complete fast-path eligibility predicate that rejects every geometry-changing option; cover the isolated overrides in sync and async rendering.
- [ ] 5. **Native gradients extrapolate before the first stop.** `interpolateColor` at `packages/react-native-nitro-qrcode/cpp/core/QRCodeGenerator.cpp:118` clamps the global position but not the interpolation fraction. For valid black/white stops at `[0.3, 0.8]`, sampling position 0 returns RGB `(103,103,103)` instead of black because a negative result wraps during the integer conversion. **Introduce Guard Clauses** for positions outside the stop interval and bound the interpolation fraction; verify pixels for nonzero first-stop locations.
- [ ] 6. **Native encoding silently truncates embedded NUL characters.** `createMatrix` at `packages/react-native-nitro-qrcode/cpp/core/QRCodeGenerator.cpp:983` sends `value.c_str()` to `makeSegments`, although the public string validator accepts NUL. A host probe shows `"hello\u0000world"` produces exactly the matrix for `"hello"`. **Substitute Algorithm** with length-aware byte encoding for this case so the complete accepted payload is encoded, and add a decode-back regression.

## P2: Inconsistencies and change costs

- [ ] 7. **Web metric exports disagree about cache bytes.** The named export at `packages/react-native-nitro-qrcode/src/index.web.ts:76` exposes the raw metrics function, while the grouped API at line 405 uses `webGetQRCodeMetrics` from line 129. After enabling metrics and generating an SVG, the named function reports 0 cache bytes while the grouped function and cache API report a positive size. **Move Function** behind one public web wrapper and route both exports through it.

## P3: Polish

### Duplicates to remove

- [ ] 8. **Generation measurement is copied between entrypoints.** `measuredSync` and `measuredAsync` are identical in `packages/react-native-nitro-qrcode/src/index.ts:69` and `packages/react-native-nitro-qrcode/src/index.web.ts:83`. Counter/error/timing changes require editing both copies. **Move Function** into the existing `metrics.ts` module and import the two helpers; remove roughly 45 duplicated lines without changing either public API.
- [ ] 9. **Three C++ runners duplicate LLVM discovery.** `scripts/test-cpp.js:17`, `scripts/test-cpp-sanitize.js:15`, and `scripts/benchmark-cpp.js:26` each define the LLVM version and the same `resolveTool` search/fallback policy. Updating supported LLVM discovery requires three matching edits. **Extract Function** into a small shared tooling module for the constant and resolver, retaining each runner's distinct compile arguments; remove roughly 40 net lines.

### Dead code

- [ ] 10. **The QR example retains an unrelated MathJax declaration.** `apps/example/types/react-native-mathjax-svg.d.ts:1` declares a package absent from the manifests and from every source, test, example, and documentation reference; a repository search for `react-native-mathjax-svg` finds only this declaration outside excluded dependency/build output. It supplies no QRCode contract and can mask an accidental unresolved import. **Remove Dead Code** by deleting the 13-line ambient declaration.

## Local implementation receipt — 2026-09-27

The ten audited findings are implemented locally for proposed patch 0.8.1. Independent review found no actionable introduced defect. The original checkboxes remain open because no landing commit or full native runtime acceptance exists.

- Focused Jest: 120 tests PASS; C++ scan-back and geometry/gradient coverage PASS. The 13-entry parity corpus regenerated with no changes; embedded-NUL payloads have separate independent quirc decode assertions.
- `check:ci`: PASS, including ASan/UBSan, packed declarations, RN compatibility, example static gates and LLVM lifecycle tests.
- Chromium actual example `/e2e`: audited version bounds, boost, async metrics and embedded-NUL PNG PASS; PNG decoded independently with jsQR. Helper, namespace, cache, metrics and validation controls PASS; no page errors or external traffic.
- Android/iOS prebuild/build: PASS. Native install/launch/smoke remains pending target selection. `release:preflight` includes `example:smoke`, so full preflight cannot be claimed from device-free checks.
- Logs: `/tmp/nitro-implementation.GbjgqhYj/qrcode-{check-ci-final,browser,android-build,ios-build}.log`.

No native performance gain or publication is claimed. Benchmark/package final receipts remain in the workspace execution ledger.

Final benchmark:cpp, audit:package and publish-package:dry-run: PASS. Full release:preflight remains incomplete because its final device smoke requires the pending runtime target choice.

## Audit 2026-09-30 at `44e1653` (v0.8.1 = npm `latest`)

Scope: bugs, performance, memory/CPU/GPU, bundle weight, API simplicity, docs drift, dependency freshness, and RN 0.76+ / Expo SDK 52+ compatibility. Items 1–10 above are not re-reported. Vendored `qrcodegen`, `fpng` and `quirc` are out of scope.

## P0: Broken

- [x] 11. **Native finder color depends on which PNG encoder runs.** In `packages/react-native-nitro-qrcode/cpp/core/QRCodeGenerator.cpp:1131-1139`, the 1-bit indexed path paints all dark layers with `options.foreground`, while the RGBA path paints finder layers with `options.eye`/`options.eyeball`. JS always sends those as `#000000` by default (`src/validation.ts:356-363`). Probe (host clang++ against current sources): `foregroundColor` red → finder red; add `logoAreaSize=20` or a red→red gradient → finder black; `shape:"circle"` → red. Web draws finders with `eyeColor` (`src/index.web.ts:231-234,483-493`), so the platforms also disagree. **Substitute Algorithm**: resolve unset eye/eyeball/eyeStroke colors to the foreground during normalization (as `alignmentColor` already is) and compare `hasCustomLayerColors` against the foreground, not constant black. Add a pixel test that toggles `logoAreaSize`.
  - Receipt: Fixed in `77f0d04`, semantics revised for 0.9.0 after review: an unset eye/eyeball/alignment/timing color inherits the foreground fill (gradient included); an explicitly set color always paints solid; explicitness travels through `NormalizedOptions.explicitColors`, optional Nitro `GenerateOptions` fields, and `*Set` flags in C++. Strokes keep the 0.8.1 rule (drawn only when set and not `#000000`); grouped-finder selection matches 0.8.1. Tests: `testFinderColorIsEncoderIndependent`, `testGradientFillsInheritedLayers`, `testExplicitBlackStrokeMeansNoStroke`, `testOutputMatchesPreviousRelease` (0.8.1 byte/pixel goldens), `testObjectAbiTracksExplicitLayerColors`, web reviewer-probe tests in `visual-parity.test.ts`.

## P1: Misleading

- [x] 12. **The iOS 16.4 floor is undocumented and has no code need; the peer range is untested below RN 0.86.** `react-native-nitro-qrcode.podspec:13` sets iOS 16.4; the only availability-sensitive C++ API is integer `std::to_chars`. RN's `min_ios_version_supported` is 15.1 (0.76–0.86) and Expo SDK 52–55 default to 15.1, so a default bare RN app or an SDK 52–55 app fails `pod install`. README.md:40-58 lists `react-native >=0.75.0` and Expo SDK 57 only, with no iOS row. Nitro 0.37 also needs NDK 27 (RN 0.76 defaults to 26.1). **Needs a decision**: use `min_ios_version_supported`, or document the floors and narrow the peer range.
  - Receipt: Fixed in `8ff7440`: podspec uses `min_ios_version_supported` (fallback 15.1); README lists iOS, NDK 27 and RN/Expo floors. 0.9.0 raises the `react-native` peer to `>=0.76.0`.

## P2: Inconsistencies and change costs

- [x] 13. **The component ignores the deprecated `shapeOptions.eyePatternShape` alias; helpers honour it.** `<QRCode>` always merges the preset (`src/qrcode-component.ts:396`), the `default` preset sets `eyeFrameShape: "square"` (`src/defaults.ts:57-61`), and `normalizeShapeOptions` prefers `eyeFrameShape` (`src/validation.ts:448-454`). Probe: component → square finders; `toPngBase64` with the same options → circle. Copy `eyePatternShape` to `eyeFrameShape` in `mergePresetShapeOptions` when only the alias is set.
  - Receipt: Fixed in `77f0d04`: `mergePresetShapeOptions` maps the alias to `eyeFrameShape`; component test asserts the native `eyePatternShape` argument.
- [x] 14. **Web clears the logo hole off-center when `size` is below the module count.** `intersectsLogoArea` centers on `options.size` (`src/render-plan.ts:152-166`) while `clearLogoArea` centers on `plan.pixelSize` (`src/index.web.ts:532-540,891-905`). Probe (size 20, V1): 48 skipped modules outside the hole, including 24 top-left finder modules. Native uses one size. Pass `pixelSize` to both.
  - Receipt: Fixed in `77f0d04`: `intersectsLogoArea`/`plan.logoArea`/`clearLogoArea` use `pixelSize` and a floor origin like native; test `centers the logo hole on the rendered pixel size`.
- [x] 15. **Non-Metro and server resolvers load the native entry.** `package.json:11-23` maps `import`/`require` to the compiled native entry, which calls `NitroModules.createHybridObject` at module scope (`src/index.ts:66`), and lists `react-native` before `browser`. Expo server rendering resolves with `node` + `import`/`require`; bare RN Metro asserts `react-native` globally. README.md:520-526 promises a web fallback. The example hides this with a resolver override in `apps/example/metro.config.js`. Unprobed (needs `expo export`). Put `browser` first, add a `node`/`default` target to the built web entry, and drop the example override.
  - Receipt: Fixed in `8ff7440`: exports list `browser` first and send `node`/`import`/`require`/`default` to `lib/*/index.web.js`; example metro override and tsconfig path alias removed; `expo export --platform web` bundles `index.web` with no `createHybridObject`.
- [x] 16. **The positional native ABI returns different bytes from the object ABI.** `generatePngBase64`/`generatePngDataUri` (+Async) in `cpp/bindings/HybridQRCode.cpp:88-206` build options without the fallbacks at :20-33, so timing/alignment stay black and the quiet zone stays white. Probe (red on black): timing module black vs red; quiet zone white vs black. `HybridQRCodeTest.cpp:53,82` compare only black-on-white. **Move Function**: put the fallbacks into `makeGenerateOptions` (`QRCodeBridgeOptions.cpp:9-68`).
  - Receipt: Fixed in `77f0d04`: positional `makeGenerateOptions` sets the fallbacks; object ABI overrides only present optionals. Tests: `testBridgeDerivedLayerDefaults`, `testPositionalAbiMatchesObjectAbi` (red on black, with and without logo).
- [x] 17. **A 4096 px layered PNG peaks at about 355 MB.** The RGBA path (any gradient, logo area or custom layer color) allocates a 16 MiB index buffer plus a 64 MiB RGBA buffer and runs fpng `FPNG_ENCODE_SLOWER` (`QRCodeGenerator.cpp:1019-1020,226-227,976-978`). Probe: 355,517,040 B peak, 62 ms, vs 22.8 MB on the indexed path; async calls share Nitro's pool of up to 10 threads. Emit an 8-bit palette PNG for non-gradient layered output, or cap the RGBA-path size.
  - Receipt: Partly fixed in `77f0d04`: non-gradient layered output uses a 4-bit palette PNG. Host peak at 4096 px: logo 354,435,696 B -> 35,602,840 B; custom eyes 354,402,928 B -> 35,602,840 B; flat 22.7 MB unchanged; gradient 354,861,680 B -> 355,123,824 B (still fpng, documented; see Deferred).
- [x] 18. **Native SVG clamps the radial gradient radius to 100%**; native PNG and web SVG use the full `hypot` radius (`QRCodeGenerator.cpp:268-276` vs :158-167 and `src/index.web.ts:1084-1097`). Probe: native `r="100.00%"`, web `r="141.42%"`.
  - Receipt: Fixed in `77f0d04`: `formatPercent(radius, false)`; test asserts `r="141.42%"`.
- [x] 19. **Screen readers announce a value the visible image does not encode.** With `keepPreviousImage` (default), `src/use-qrcode-generation.ts:66-69` and `src/qrcode-component.ts:485-489` report `busy:false` and "QR code for <new value>" while the old image shows; after a failed regeneration it never clears (probe). Derive `busy` and the label from the displayed result.
  - Receipt: Fixed in `77f0d04`: label uses the displayed result's value; `busy` is true only while the current options are pending. Component test covers pending and failed regeneration.
- [x] 20. **Web and native round module edges differently.** Web uses `Math.round` and a `*0.18` stroke inset (`src/render-plan.ts:84-85,273`; `src/index.web.ts:379-381,623-629`); native uses floor division and `/5` (`QRCodeGenerator.cpp:1047-1050,1064-1066,1107`). 14 of 30 boundaries differ for a V1 code at 360 px; README:328 documents a 1 px tolerance only for circles.
  - Receipt: Fixed in `77f0d04`: web uses floor module/quiet-zone edges, integer `/5` stroke inset, floor logo origin and integer radius divisions; README tolerance text updated.
- [x] 21. **Release and e2e gates that cannot fail.** `release:preflight` ends with non-strict `example:smoke`, which exits 0 with both platforms skipped (probe), so the publish workflow's preflight step is green with no device evidence. `apps/example/app/e2e-combo.tsx:106-111` fails only on `cacheMisses`, which native never records. `apps/example/components/generation-matrix.ts:48-96` hand-copies preset shapes and has drifted (dots, mosaic, fluid differ). No flow presses `e2e-run-audit`. Use `--strict` locally with a device-free CI variant, assert on `snapshot.requests`, and import `PRESET_SHAPE_OPTIONS`.
  - Receipt: Fixed in `04fe242`: local `release:preflight` runs strict smoke, publish workflow runs `release:preflight:ci`; e2e-combo asserts `requests <= 1`; generation matrix imports `PRESET_SHAPE_OPTIONS`; `qa-full-features.ad` runs `e2e-run-audit`.
- [x] 22. **README omits component defaults**: `keepPreviousImage=true`, `hideLogoUntilReady=true`, component `size=180` vs helper `size=512` (`src/defaults.ts:12,52-54`; `src/qrcode-component.ts:194,218`). README:278-283 also says cacheBytes is web-only and metrics are opt-in; native reports cacheBytes and metrics are on in `__DEV__`.
  - Receipt: Fixed in `bc34f42`: README lists component/helper defaults, metrics availability and cacheBytes on all platforms.
- [x] 23. **Tooling failures.** `scripts/setup.js:78,81` ignores failed codegen/build and prints success (probe). `example:e2e:ios-device` runs `bun scripts/run-ios-device-e2e.sh`, and Bun Shell rejects `[[ $# -lt 1 ]]`, so the physical-iPhone command in AGENTS.md always fails (probe); its empty-suite guard (:30-39) can never fire. Run it with `bash`, and check the setup results.
  - Receipt: Fixed in `04fe242`: setup exits 1 on codegen/build failure; `example:e2e:ios-device` runs under bash; empty suites fail before device launch.

## P3: Polish

- [x] 24. **Metrics and dead code**: web `getMatrix` is not wrapped in `measuredSync` (`src/index.web.ts:301-322`; probe: 0 requests). `validateLogoDimensions` repeats a check that `sanitizeInteger` already throws (`src/validation.ts:627-631`). `orbit` (`src/validation.ts:182`) is a documented no-op with no `@deprecated` tag and is still threaded through the component. `cpp/CMakeLists.txt` is unused by any script and ships in the tarball with targets that `files` excludes. `package-doc-lifecycle.js:88-91` ignores `allowMissingFinal`.
  - Receipt: Fixed in `77f0d04`/`04fe242`: web `getMatrix` is measured; dead `validateLogoDimensions` branch removed; `orbit` is `@deprecated` and no longer threaded through the component; `cpp/CMakeLists.txt` deleted; `allowMissingFinal` removed.
- [x] 25. **Tests and docs**: quiet-zone tests assert only the data-URI prefix (`src/__tests__/web-color-rendering.test.ts:102-124`); `runSelfCheck` in `scripts/assert-example-smoke.js:387-418` checks only its own entries; README lists no validation code table; `docs/benchmarks.md:62-64` draws an ArrayBuffer-vs-base64 conclusion its own table does not support; the "Whitespace trimmed" specimen has no whitespace (`e2e-render.tsx:31`); example lint covers only `app/`; `apps/example/gradle.properties` is not read by Gradle; the publish job builds before `prepublishOnly` rebuilds; the bug template names Nitro 0.36.5; README Development steps skip `example:prebuild`.
  - Receipt: Fixed in `77f0d04`/`04fe242`/`bc34f42`: quiet-zone tests assert rectangles; smoke self-check and `example:smoke:ci` removed; validation code table; benchmark sentence replaced; padded-whitespace specimen; example lint covers components/plugins/config and root scripts are linted; `apps/example/gradle.properties` deleted; publish job build step removed; bug template names 0.9.0/RN 0.86.3/Nitro 0.37.1; README Development adds `example:prebuild`.

### Coverage note (2026-09-30)

Slices read in full by parallel read-only reviewers: A = library TypeScript + tests, Android shell, podspec, config plugin, manifest (39 files, 9.1k lines), B = first-party C++ + root tooling scripts (32 files, 8.3k lines), C = example app, README, CHANGELOG, docs, CI, e2e (46 files, 7.5k lines). Every P0/P1 was re-checked against the cited lines; item 11 was rebuilt and re-run on the host against current `cpp/` sources.

Checked with no certain finding: boundaries; JS cache bounds (128 entries / 4 MiB, oversized entries rejected); option-identity memoization (re-renders do not regenerate); `createRenderPlan` cost (5.9 ms at V40/4096 px); bundle weight (`qrcode` is imported only by `src/index.web.ts`; the native entry never reaches it); BoundedCache accounting and thread safety; NaN/Inf/fractional casts; async lifetime capture; Kotlin stdlib pin (harmless floor).

Tracked items 1–10 landed in `e10a9bf` (released as v0.8.1) and still hold. Their boxes stay open per the receipt, which also requires native runtime acceptance.

Dependency freshness (npm registry, 2026-09-30): `react-native-nitro-modules`/`nitrogen` 0.37.1 = latest; `qrcode` 1.5.4 = latest; `typescript` ^6.0.3 vs latest 7.0.2; `jest` ^29.7.0 vs latest 30.5.2. Example Expo ~57.0.25 (siblings 57.0.26).

### Deferred (2026-09-30)

- 17 (gradient part): gradient PNGs still use RGBA + `fpng` and peak at about 355 MB at 4096 px (about 90 MB at 2048 px). A row-streaming zlib encoder would remove the RGBA and fpng buffers but replaces the vendored encoder for that path; left for a separate change with benchmark evidence. Documented in README.
- Curved-shape edge pixels still differ by up to one pixel per module (canvas antialiasing vs native per-pixel fill); inherent to the two rasterizers.
- `scripts/package-doc-lifecycle.js` replacement (cross-repo follow-up per brief); two lint warnings remain in it and `scripts/llvm-tools.test.ts`, so `lint:scripts` fails on errors only.
- Dependency majors (`typescript` 7, `jest` 30) not taken in this patch.
- Native runtime acceptance (prebuild, Android/iOS builds, strict smoke, e2e flows) is pending the lead's device run.
- Version: 0.8.2 was never published; the branch is `v0.9.0` because default output changes (gradient-covered finders/timing/alignment, web floor rounding, exports targets, peer floor) are breaking for 0.x.
