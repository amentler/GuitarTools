# Graph Report - /home/azureuserhauptmann/privat/GuitarToolsALT/js  (2026-05-07)

## Corpus Check
- 104 files · ~99,062 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 645 nodes · 1404 edges · 31 communities (28 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `assert()` - 23 edges
2. `throwBindingError()` - 20 edges
3. `matchChordPath()` - 19 edges
4. `GtFretboard` - 19 edges
5. `abort()` - 14 edges
6. `readLatin1String()` - 14 edges
7. `debugStore` - 12 edges
8. `requestMicrophoneStream()` - 10 edges
9. `closeAudioSession()` - 10 edges
10. `detectPitch()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `classifyFrame()` --calls--> `noteToFrequency()`  [INFERRED]
  shared/audio/fastNoteMatcher.js → domain/pitch/pitchCore.js
- `classifyFrame()` --calls--> `frequencyToNote()`  [INFERRED]
  shared/audio/fastNoteMatcher.js → domain/pitch/pitchCore.js
- `createSheetMusicMicFeature()` --calls--> `createGlobalDebugStore()`  [INFERRED]
  games/sheetMusicMic/sheetMusicMicExercise.js → shared/debug/debugStore.js
- `initSettings()` --calls--> `getSetting()`  [EXTRACTED]
  app.js → shared/globalSettings.js
- `ensureMic()` --calls--> `requestMicrophoneStream()`  [EXTRACTED]
  games/chordExerciseEssentia/essentiaChordDetection.js → shared/audio/microphoneService.js

## Communities (31 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (47): validateChord(), filter, getFilteredChords(), renderGrid(), autoAdvanceOrWait(), createChordRecorderTool(), GUITAR_SIZES, GUITAR_STRINGS (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (59): getDefaultChordDetectionPath(), isEssentiaDetectionPath(), resolveChordDetectionPath(), buildBassSupportByChord(), audioSession, CHORD_TEMPLATES, computeHpcp(), computeHpcpEssentia() (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (41): closeAudioSession(), createAudioSessionState(), openAudioSession(), classifyFrame(), createMatchState(), FFT_SIZE_OPTIONS, getMinSamplesFor(), getRecommendedFftSize() (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (34): GERMAN_TO_CHROMA, getExpectedNoteClasses(), matchDetectedNotes(), parseChordName(), applyGuitarBandpass(), centsDistance(), dampAttack(), detectPitch() (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (37): createGuitarTunerFeature(), nextGuidedStepState(), startGuidedModeState(), stopGuidedModeState(), createAnalysisRuntime(), createGuidedState(), createTunerDisplayState(), resetForMount() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (26): CHROMATIC_NOTES, drawRandom(), getNoteAtPosition(), getRandomPosition(), OPEN_STRING_NOTES, evaluateAnswer(), initGameState(), clampWeight() (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (19): calcFirstBarWidth(), EndlessBarGenerator, generateBars(), getFilteredNotes(), getTimeSignatureConfig(), NOTES, validateTimeSignature(), pitchToVfKey() (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (3): createAudioContext(), resolveAudioContextCtor(), calcBeatX()

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (10): GtMenuCard, GtFretboard, renderFretboard(), computeFretWireX(), el(), INLAY_FRETS, renderInteractiveFretboard(), STRING_LABELS (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (14): GLOBAL_DEBUG_DEFAULTS, createBasePageContext(), createGlobalDebugStore(), loadPersistedState(), normalizeString(), resolvePageUrl(), debugStore, getSheetMusicMicStorage() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (16): closeAkkordfolgenAudioSession(), createAkkordfolgenAudioSession(), openAkkordfolgenAudioSession(), buildProgression(), CHORD_NAME_OVERRIDES, createBeatChordSync(), generateRandomProgression(), MAJOR_KEYS (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (21): craftInvokerFunction(), createNamedFunction(), __embind_register_class(), __embind_register_class_constructor(), __embind_register_class_function(), __embind_register_class_property(), __embind_register_function(), embind__requireFunction() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (21): attachFinalizer(), ClassHandle_clone(), ClassHandle_delete(), ClassHandle_deleteLater(), constNoSmartPtrRawPointerToWireType(), detachFinalizer(), downcastPointer(), _embind_repr() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (20): addFunctionWasm(), addRunDependency(), assert(), ccall(), convertJsFunctionToWasm(), createExportWrapper(), createWasm(), doCallback() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (16): craftEmvalAllocator(), __emval_as(), __emval_call_void_method(), emval_get_global(), __emval_get_module_property(), __emval_get_property(), __emval_new(), __emval_new_cstring() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (15): __addDays(), __arraySum(), ___assert_fail(), _atexit(), checkUnflushedContent(), ___cxa_atexit(), _exit(), exitRuntime() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (13): __embind_register_bool(), __embind_register_float(), __embind_register_integer(), __embind_register_memory_view(), __embind_register_std_string(), __embind_register_void(), __emval_decref(), __emval_run_destructors() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (12): abort(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write(), getBinary(), getBinaryPromise() (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.27
Nodes (10): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), checkStackCookie(), initRuntime(), postRun(), preMain(), preRun() (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (4): CORE_PRECACHED_URLS, PAGE_PRECACHED_URLS, PRECACHE_URLS, REQUIRED_URLS

### Community 21 - "Community 21"
Cohesion: 0.54
Nodes (7): checkClipping(), checkNoOnset(), checkSilenceRatio(), checkTooQuiet(), checkTooShort(), rms(), runQualityGates()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), __getExecutableName(), writeAsciiToMemory()

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (5): alignUp(), _emscripten_get_heap_size(), emscripten_realloc_buffer(), _emscripten_resize_heap(), updateGlobalBufferAndViews()

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (3): demangle(), jsStackTrace(), stackTrace()

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (3): finish(), processData(), removeRunDependency()

## Knowledge Gaps
- **41 isolated node(s):** `btnUpdate`, `menuView`, `DEFAULTS`, `CORE_PRECACHED_URLS`, `PAGE_PRECACHED_URLS` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requestMicrophoneStream()` connect `Community 2` to `Community 1`, `Community 11`, `Community 4`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `GtFretboard` connect `Community 9` to `Community 8`, `Community 6`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `CHORDS` connect `Community 0` to `Community 11`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `btnUpdate`, `menuView`, `DEFAULTS` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._