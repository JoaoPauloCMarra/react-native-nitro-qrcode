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
