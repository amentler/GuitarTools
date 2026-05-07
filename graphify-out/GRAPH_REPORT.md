# Graph Report - /home/azureuserhauptmann/privat/GuitarToolsALT  (2026-05-07)

## Corpus Check
- Large corpus: 497 files · ~156,746 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1326 nodes · 2749 edges · 71 communities (69 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1946363c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]

## God Nodes (most connected - your core abstractions)
1. `__dirname` - 26 edges
2. `assert()` - 23 edges
3. `readWavFile()` - 22 edges
4. `GtFretboard` - 21 edges
5. `toAverageHpcp()` - 20 edges
6. `throwBindingError()` - 20 edges
7. `matchChordPath()` - 19 edges
8. `buildChordTemplates()` - 18 edges
9. `result` - 17 edges
10. `repoRoot` - 17 edges

## Surprising Connections (you probably didn't know these)
- `detectNoteFromSamples()` --calls--> `detectPitch()`  [INFERRED]
  tests/helpers/audioFixtureRunner.js → js/shared/audio/guitarPitchDetection.js
- `detectNoteFromSamples()` --calls--> `frequencyToNote()`  [INFERRED]
  tests/helpers/audioFixtureRunner.js → js/domain/pitch/pitchCore.js
- `pitchClasses()` --calls--> `getChordNotes()`  [INFERRED]
  tests/unit/akkordData.test.js → js/domain/chords/chordDetectionLogic.js
- `adaptiveBuffer()` --calls--> `getRecommendedFftSize()`  [EXTRACTED]
  tests/unit/fastNoteMatcher.test.js → js/shared/audio/fastNoteMatcher.js
- `collectPositiveFolderFixtures()` --calls--> `extractHpcpAnalysisFromWav()`  [EXTRACTED]
  scripts/introduce-chord-fixture.mjs → tests/helpers/chordHpcpExtraction.js

## Communities (71 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (52): createAkkordTrainerFeature(), createChordExerciseEssentiaFeature(), GLOBAL_DEBUG_DEFAULTS, createBasePageContext(), createGlobalDebugStore(), loadPersistedState(), normalizeString(), resolvePageUrl() (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (59): tool, startBtn, errorMsg, createGuitarTunerFeature(), nextGuidedStepState(), startGuidedModeState(), stopGuidedModeState(), createAnalysisRuntime() (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (49): closeAkkordfolgenAudioSession(), createAkkordfolgenAudioSession(), openAkkordfolgenAudioSession(), buildProgression(), CHORD_NAME_OVERRIDES, createBeatChordSync(), generateRandomProgression(), MAJOR_KEYS (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (32): abort(), addRunDependency(), alignUp(), createWasm(), _emscripten_get_heap_size(), emscripten_realloc_buffer(), _emscripten_resize_heap(), _environ_get() (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): validateChord(), getEssentia(), getRandomChord(), LEVELS, CHORD_CATEGORIES, CHORDS, validateFingerData(), anchor (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (33): greenNotes, repeatedOpenStringsAudioPath, NOTES, peaks, spectrum, config, values, batch1 (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (25): pc, metronomeInit, metronomeSetBeatsPerMeasure, metronomeSetBpm, metronomeStart, metronomeStop, renderChordDiagram, beatsSelect (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (34): BASS_VARIANT_COUNTERPART, buildOpenStrumTemplate(), CHORD_MATCH_SPECIAL_CASES, CHORD_TYPE_PROFILES, clampConfidence(), DEFAULT_PROFILE, evaluateAnnotatedTargetAcceptance(), evaluateBestMatchCompatibility() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (28): matchHpcpToChord(), aMinorResult, EMPTY_STRUM_BASS_SUPPORT, EMPTY_STRUM_FIXTURES, frozenFrames, MATCHER_FIXTURES, sus2Result, TEMPLATES (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (14): collectJsFiles(), findForbiddenImports(), getRelativeImports(), resolveImport(), toRepoRelative(), violations, fetchMock, hrefByTitle (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (21): getDefaultChordDetectionPath(), isEssentiaDetectionPath(), resolveChordDetectionPath(), buildBassSupportByChord(), audioSession, computeHpcp(), computeHpcpEssentia(), computePureJsHpcp() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (25): constNoSmartPtrRawPointerToWireType(), craftInvokerFunction(), createNamedFunction(), __embind_register_class(), __embind_register_class_constructor(), __embind_register_class_function(), __embind_register_class_property(), __embind_register_function() (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (21): classifyFrame(), FFT_SIZE_OPTIONS, getMinSamplesFor(), parsePitch(), yinMinPeriods(), midiToCandidate(), noteToFrequency(), adaptiveBuffer() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (18): buildPeakFrames(), CATALOG_FILE, CHORD_TEMPLATES, collectOpenStrumNegativeFixtures(), collectPositiveFolderFixtures(), ensureDirectory(), GOLDEN_FILE, inferChordFolder() (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (16): calcFirstBarWidth(), generateBars(), getFilteredNotes(), getTimeSignatureConfig(), validateTimeSignature(), computeSheetMicLayout(), renderScoreWithStatus(), STATUS_COLORS (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (14): applyGuitarBandpass(), centsDistance(), dampAttack(), detectPitch(), detectPitchHps(), detectPitchYin(), hpsFromMagnitudes(), onePoleHighpass() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (16): detectNoteFromSamples(), getAudioFixtures(), runCase(), sliceCenterWindow(), bad, __filename, fixtures, FIXTURES_DIR (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (7): missedNotes, SilentAnalyserNode, SilentAudioContext, EndlessBarGenerator, MockAudioContext, constructor(), getUserMedia

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (13): getChordBassNote(), CHORD_FIXTURES_DIR, extractBassScoreForChordFromWav(), extractBassSupportMapFromWav(), buildFrequencyFrames(), computeDbSpectrum(), extractHpcpAnalysisFromWav(), fftInPlace() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (17): cosineSimilarity(), t1, t2, t5, v, active, cDur, gDur (+9 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (11): feature, pitchToVfKey(), toGuitarWrittenPitch(), createMockAudioContext(), buildDom(), accepted, RIGHT_G3, WRONG_E2 (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (19): craftEmvalAllocator(), __emval_addMethodCaller(), __emval_as(), __emval_call_void_method(), emval_get_global(), __emval_get_method_caller(), __emval_get_module_property(), __emval_get_property() (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (18): buildSidecarJson(), buildZip(), crc32(), downloadAllAsZip(), downloadBlob(), downloadJson(), generateRandom5(), getAllRecordings() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (15): matchEssentiaFingerprintHpcpToChord(), avgHpcp, getDetectionResult(), getFixture(), getProbeResult(), bassBlockedFPs, bassCriticalTPs, bidirectionalPairs (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (13): buildChordTemplates(), getChordNotes(), evaluateChordRecognitionConfusion(), formatChordRecognitionMetricsReport(), formatPercent(), safeDivide(), summarizeRow(), evaluateEssentiaFingerprintConfusion() (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (13): calcBeatX(), steps, UNEQUAL_LAYOUT, firstBeatBar1, lastBeatBar0, LAYOUT, single, x (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (12): computeFrameRms(), consumeOnsetGate(), createOnsetGateState(), isOnsetGateOpen(), updateOnsetGate(), createNotePlayingAudioSession(), createNotePlayingExerciseFeature(), resolveNotePlayingUI() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (18): addFunctionWasm(), assert(), ccall(), convertJsFunctionToWasm(), createExportWrapper(), doCallback(), done(), dynamicAlloc() (+10 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (11): GERMAN_TO_CHROMA, getExpectedNoteClasses(), matchDetectedNotes(), parseChordName(), TYPE_INTERVALS, OPEN_STRING_MIDI, frequencyToNote(), NOTE_NAMES (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (14): attackDetections, { cmnd }, d2Frames, D3_DIR, D3_FIXTURES, hop, prepared, signal (+6 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (13): autoAdvanceOrWait(), GUITAR_SIZES, GUITAR_STRINGS, PRE_COUNTDOWN, sleep(), STRUM_MODI, TECHNIKEN, buildFileName() (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (10): cDurAudioPath, ALL_CHORD_NAMES, ALL_TEMPLATES, NON_STRICT_MATRIX_CASES, POSITIVE_PREPARED_FIXTURES, rows, targetRows, POSITIVE_FROZEN_FIXTURES (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.2
Nodes (7): Essentia(), clampStart(), createAdvancingWait(), createFakeChordDetectionAnalyserFromWav(), analyser, detectFromWav(), fftSize

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (14): bottom, clickTargets, element, events, firstFretWireX, fret1, fret1MarkerX, fret1Zone (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.27
Nodes (13): getNoteAtPosition(), getAvailableNotes(), getAvailablePitches(), getPitchAtPosition(), getPositionsForNote(), getPositionsForPitch(), getRandomNote(), getRandomPitch() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (12): CHROMATIC_NOTES, drawRandom(), getRandomPosition(), OPEN_STRING_NOTES, evaluateAnswer(), initGameState(), STRING_LABELS, draws (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.27
Nodes (10): checkClipping(), checkNoOnset(), checkSilenceRatio(), checkTooQuiet(), checkTooShort(), rms(), runQualityGates(), clipCount (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (6): url, CORE_PRECACHED_URLS, PAGE_PRECACHED_URLS, PRECACHE_URLS, REQUIRED_URLS, manifest

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (14): attachFinalizer(), ClassHandle_clone(), ClassHandle_delete(), ClassHandle_deleteLater(), detachFinalizer(), downcastPointer(), getBasestPointer(), getInheritedInstance() (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.19
Nodes (10): createAkkordUebersichtFeature(), filter, getFilteredChords(), renderGrid(), createChordRecorderTool(), ROOT_ORDER, TYPE_ORDER, chordStringToFretboardIndex() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.19
Nodes (11): buildBassNeighborScores(), DEFAULT_HARMONIC_WEIGHTS, DEFAULT_HARMONICS, evaluateBassSupportForChord(), findPeakLinearMagnitudeNearFrequency(), FUNDAMENTAL_HARMONICS, FUNDAMENTAL_WEIGHTS, scoreBassCandidateFromSpectrum() (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.19
Nodes (12): container, destroy(), notationDiv, onBeat(), playbackBarDestroy, playbackBarShow, playbackOnBeat, playbackSetBpm (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.23
Nodes (9): closeSheetMusicMicAudioSession(), createSheetMusicMicAudioSession(), openSheetMusicMicAudioSession(), createSheetMusicMicFeature(), resolveSheetMusicMicUI(), resolveInjectedBars(), currentNoteEl, frameLevels (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.26
Nodes (9): createMatchState(), getRecommendedFftSize(), updateMatchState(), runSequenceSimulation(), FIXTURE_PATH, loadFixture(), REPEATED_OPEN_STRINGS_FIXTURE_PATH, replayedSamples (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (13): __embind_register_bool(), __embind_register_float(), __embind_register_integer(), __embind_register_memory_view(), __embind_register_std_string(), __embind_register_void(), __emval_decref(), __emval_run_destructors() (+5 more)

### Community 45 - "Community 45"
Cohesion: 0.18
Nodes (10): addRecording(), clearRecordings(), firstChord, manageButton, multi1, pause(), pauseMock, play() (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (11): bottomStringFret1, fret3Circle, fret4Circle, highE, highECy, lowE, lowECy, resultCircles (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.39
Nodes (8): getSheetMusicMicStorage(), loadSheetMusicMicPrefs(), saveSheetMusicMicEndless(), createSheetMusicReadingFeature(), saveSheetMusicActive(), saveSheetMusicBpm(), saveSheetMusicShowTab(), saveSheetMusicTimeSig()

### Community 48 - "Community 48"
Cohesion: 0.24
Nodes (8): CHORD_HPCP_FIXTURE_CASES, createEssentiaPage(), createStaticServer(), deepNormalize(), essentiaLibDir, fixtureDir, outputFile, normalizeNumber()

### Community 49 - "Community 49"
Cohesion: 0.2
Nodes (9): display, select, slider, toggleBtn, activeBtn, endlessBtn, label, score (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (9): buf, buffer, freq, hz, level, mags, { note, octave }, synth() (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.24
Nodes (5): GtFretboard, render(), renderMock, playbackBarRender, positions

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (8): matchPureJsHpcpToChord(), analysisCache, bassSupportCache, getBassSupport(), getDirectAnalysis(), getDirectMatchResult(), OPEN_STRUM_CASES, TARGETED_CASES

### Community 53 - "Community 53"
Cohesion: 0.27
Nodes (10): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), checkStackCookie(), initRuntime(), postRun(), preMain(), preRun() (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.2
Nodes (10): _atexit(), checkUnflushedContent(), ___cxa_atexit(), demangle(), _exit(), exitRuntime(), jsStackTrace(), stackTrace() (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.36
Nodes (6): assertSequenceFixture(), deduplicateConsecutive(), getSequenceFixture(), SEQUENCES_DIR, { deduped, expectedNotes, isFastTempo }, minNotes

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (6): aSus2AudioPath, eMollTwoFingerRegressionAudioPath, observer, pushCurrentText(), emptyStrumAudioPath, feedback

### Community 57 - "Community 57"
Cohesion: 0.28
Nodes (3): GtMenuCard, backLink, header

### Community 58 - "Community 58"
Cohesion: 0.22
Nodes (8): data, enc, eocd, extracted, files, text, zip, last

### Community 59 - "Community 59"
Cohesion: 0.25
Nodes (6): root, css, hintsMarginTop, notationWidth, targetHeight, targetMarginBottom

### Community 60 - "Community 60"
Cohesion: 0.5
Nodes (7): renderFretboard(), computeFretWireX(), el(), INLAY_FRETS, renderInteractiveFretboard(), stringY(), txt()

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (8): __addDays(), __arraySum(), ___assert_fail(), intArrayFromString(), __isLeapYear(), lengthBytesUTF8(), _strftime(), UTF8ToString()

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (6): fret1String0, fretboard, mutedLines, nut0, openCircles, selectedMarker

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (5): filledTargets, fretPlaceholder, fretTarget, openPlaceholder, openTarget

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (5): fretNumbers, fretValues, lines, texts, zones

### Community 66 - "Community 66"
Cohesion: 0.4
Nodes (4): backBtn, card, pages, title

## Knowledge Gaps
- **357 isolated node(s):** `url`, `CATALOG_FILE`, `GOLDEN_FILE`, `ROOT_NEGATIVE_CASES`, `STATIC_EXTRA_NEGATIVE_CASES` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `result` connect `Community 19` to `Community 0`, `Community 1`, `Community 35`, `Community 36`, `Community 5`, `Community 8`, `Community 16`, `Community 50`, `Community 52`, `Community 23`, `Community 28`, `Community 29`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `__dirname` connect `Community 31` to `Community 32`, `Community 2`, `Community 5`, `Community 8`, `Community 43`, `Community 13`, `Community 48`, `Community 16`, `Community 18`, `Community 23`, `Community 52`, `Community 55`, `Community 24`, `Community 56`, `Community 29`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `constructor()` connect `Community 17` to `Community 32`, `Community 6`, `Community 45`, `Community 51`, `Community 25`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `url`, `CATALOG_FILE`, `GOLDEN_FILE` to the rest of the system?**
  _357 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._