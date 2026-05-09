# Graph Report - js  (2026-05-09)

## Corpus Check
- 98 files · ~97,732 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 832 nodes · 1540 edges · 40 communities (38 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6248ac08`
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

## God Nodes (most connected - your core abstractions)
1. `assert()` - 23 edges
2. `throwBindingError()` - 21 edges
3. `matchChordPath()` - 19 edges
4. `readLatin1String()` - 16 edges
5. `abort()` - 14 edges
6. `MetronomeLogic` - 13 edges
7. `GtFretboard` - 11 edges
8. `detectPitch()` - 10 edges
9. `runChordDetectionSession()` - 10 edges
10. `PlaybackController` - 10 edges

## Surprising Connections (you probably didn't know these)
- `classifyFrame()` --calls--> `noteToFrequency()`  [INFERRED]
  shared/audio/fastNoteMatcher.js → domain/pitch/pitchCore.js
- `classifyFrame()` --calls--> `frequencyToNote()`  [INFERRED]
  shared/audio/fastNoteMatcher.js → domain/pitch/pitchCore.js
- `_renderNotation()` --calls--> `calcFirstBarWidth()`  [INFERRED]
  games/sheetMusicReading/sheetMusicSVG.js → shared/music/sheetMusicLogic.js
- `initSettings()` --calls--> `getSetting()`  [EXTRACTED]
  app.js → shared/globalSettings.js
- `ensureMic()` --calls--> `requestMicrophoneStream()`  [EXTRACTED]
  games/chordExerciseEssentia/essentiaChordDetection.js → shared/audio/microphoneService.js

## Communities (40 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (56): closeAudioSession(), createAudioSessionState(), openAudioSession(), classifyFrame(), createMatchState(), FFT_SIZE_OPTIONS, getMinSamplesFor(), getRecommendedFftSize() (+48 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (18): alignUp(), _emscripten_get_heap_size(), emscripten_realloc_buffer(), _emscripten_resize_heap(), _environ_get(), _environ_sizes_get(), finish(), getEnvStrings() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (42): countMatchingRecordings(), isChordSufficient(), GUITAR_SIZES, GUITAR_STRINGS, PRE_COUNTDOWN, ROOT_ORDER, STRUM_MODI, TECHNIKEN (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (35): GERMAN_TO_CHROMA, getExpectedNoteClasses(), matchDetectedNotes(), parseChordName(), TYPE_INTERVALS, applyGuitarBandpass(), centsDistance(), dampAttack() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (25): GtExerciseHeader, GtMenuCard, CHROMATIC_NOTES, drawRandom(), getNoteAtPosition(), getRandomPosition(), OPEN_STRING_NOTES, STRING_LABELS (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (38): createGuitarTunerFeature(), nextGuidedStepState(), startGuidedModeState(), stopGuidedModeState(), createAnalysisRuntime(), createGuidedState(), createTunerDisplayState(), resetForMount() (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (27): createChordRecorderUI(), chordStringToFretboardIndex(), fretboardIndexToChordString(), evaluateAnswer(), initGameState(), btnUpdate, debugStore, initSettings() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (37): BASS_VARIANT_COUNTERPART, buildOpenStrumTemplate(), CHORD_MATCH_SPECIAL_CASES, CHORD_TYPE_PROFILES, clampConfidence(), DEFAULT_PROFILE, evaluateAnnotatedTargetAcceptance(), evaluateBestMatchCompatibility() (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (28): validateChord(), CHORD_DETECTION_PATHS, getDefaultChordDetectionPath(), isEssentiaDetectionPath(), resolveChordDetectionPath(), buildBassSupportByChord(), audioSession, CHORD_TEMPLATES (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (5): createAudioContext(), createAudioContextFactory(), resolveAudioContextCtor(), MetronomeLogic, PlaybackController

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (16): filter, getFilteredChords(), renderGrid(), ROOT_ORDER, TYPE_ORDER, A_SHAPE_OFFSETS, BASE_CHORDS, buildCompleteChordCatalog() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (11): calcFirstBarWidth(), EndlessBarGenerator, getTimeSignatureConfig(), NOTES, validateTimeSignature(), appendRow(), _renderNotation(), renderScore() (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (22): craftInvokerFunction(), createNamedFunction(), __embind_register_class(), __embind_register_class_constructor(), __embind_register_class_function(), __embind_register_class_property(), __embind_register_function(), embind__requireFunction() (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (22): attachFinalizer(), ClassHandle_clone(), ClassHandle_delete(), ClassHandle_deleteLater(), constNoSmartPtrRawPointerToWireType(), detachFinalizer(), downcastPointer(), _embind_repr() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (15): closeAkkordfolgenAudioSession(), createAkkordfolgenAudioSession(), openAkkordfolgenAudioSession(), buildProgression(), createBeatChordSync(), generateRandomProgression(), MAJOR_KEYS, PROGRESSIONS (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (18): addFunctionWasm(), addRunDependency(), assert(), ccall(), convertJsFunctionToWasm(), createExportWrapper(), createWasm(), doCallback() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (17): __addDays(), __arraySum(), ___assert_fail(), _atexit(), checkUnflushedContent(), ___cxa_atexit(), __embind_register_std_string(), intArrayFromString() (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (16): craftEmvalAllocator(), __emval_as(), __emval_call_void_method(), emval_get_global(), __emval_get_module_property(), __emval_get_property(), __emval_new(), __emval_new_cstring() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (16): abort(), demangle(), demangleAll(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (14): Akkord-Erkennung, Akkordfolgen-Daten, akkordfolgenTrainer – Akkordfolgen-Trainer, Akkordname-Parsing (`akkordfolgenChordMatcher.js`), Architektur, Cancellation, Chord-Diagramme, code:block1 (akkordfolgenTrainer.js) (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (13): Architecture, code:js (const { note, octave } = frequencyToNote(medianHz);), Detection Strategy, Files, Important: Guitar Notation vs. Sounding Pitch, Legacy (backward compatibility), Logic API, Navigation (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (13): __embind_register_bool(), __embind_register_emval(), __embind_register_float(), __embind_register_integer(), __embind_register_memory_view(), __embind_register_std_wstring(), __embind_register_void(), __emval_decref() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.21
Nodes (12): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), checkStackCookie(), _exit(), exitRuntime(), initRuntime(), postRun() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (11): AI Collaboration, Architektur, Audio-Pipeline (nach Anschlag-Erkennung), Chord-Template-Matching, chordExerciseEssentia – Akkord-Übung mit Essentia.js HPCP-Erkennung, code:block1 (chordExerciseEssentia/), code:block2 (chordExerciseEssentia.js), Dateien (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (6): GLOBAL_DEBUG_DEFAULTS, createBasePageContext(), createGlobalDebugStore(), loadPersistedState(), normalizeString(), resolvePageUrl()

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (9): AI Collaboration & Documentation, Dateien, Implementierter Stand (laut backlog.md), `playbackBar.js`, `playbackController.js`, `sheetMusicLogic.js`, `sheetMusicReading.js`, sheetMusicReading – Noten lesen Übung (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (9): akkordUebersicht – 📋 Akkord Übersicht, Architecture, Category Labels, code:js ({ key: 'akkordUebersicht', path: './tools/akkordUebersicht/a), Dependencies, Files, HTML IDs, Purpose (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (8): AI Collaboration & Documentation, code:js ({ mode: 'standard'|'chromatic', note, octave, cents, isActiv), Files, Guided Tuning Logic, Guitar Tuner – `js/tools/guitarTuner/`, `guitarTuner.js`, `tunerLogic.js`, `tunerSVG.js`

### Community 29 - "Community 29"
Cohesion: 0.25
Nodes (4): CORE_PRECACHED_URLS, PAGE_PRECACHED_URLS, PRECACHE_URLS, REQUIRED_URLS

### Community 30 - "Community 30"
Cohesion: 0.39
Nodes (7): computeFretWireX(), el(), INLAY_FRETS, renderInteractiveFretboard(), STRING_LABELS, stringY(), txt()

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (7): Ablauf, AI Collaboration & Documentation, code:html (<gt-fretboard id="ton-finder-svg" class="fretboard-container), code:js (// Fretboard konfigurieren), Dateien, Griffbrett-Integration (Phase 1), tonFinder – Inverses Griffbrett-Quiz

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (6): AI Collaboration & Documentation, Files, `fretboardExercise.js` – Exercise controller, `fretboardLogic.js` – Pure note calculations, `fretboardSVG.js` – SVG fretboard renderer, fretboardToneRecognition – Identify Notes on the Fretboard

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (6): AI Collaboration & Documentation, `akkordLogic.js` – Chord database and validation, `akkordSVG.js` – Interactive Chord Diagram renderer, akkordTrainer –🎸 Chord Trainer, `akkordTrainer.js` – Exercise controller, Files

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (5): AI Collaboration & Documentation, Architecture, Development, Key Features, Metronome Tool

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (5): chordRecorder — Akkord-Aufnahme-Tool, code:block1 (chordRecorder.js           — Factory createChordRecorderTool), Dateien, Implementierungsphasen, Zweck

## Knowledge Gaps
- **126 isolated node(s):** `debugStore`, `btnUpdate`, `menuView`, `DEFAULTS`, `storageService` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requestMicrophoneStream()` connect `Community 0` to `Community 8`, `Community 2`, `Community 5`, `Community 14`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `createStorageService()` connect `Community 0` to `Community 24`, `Community 2`, `Community 6`, `Community 31`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `closeAudioSession()` connect `Community 0` to `Community 8`, `Community 11`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `debugStore`, `btnUpdate`, `menuView` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._