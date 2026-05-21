# js/shared/audio — Shared Audio Modules

Dieses Verzeichnis enthält alle wiederverwendbaren Audio-Module, die von mehreren Features genutzt werden.

## Modulübersicht

| Datei | Zweck |
|---|---|
| `audioContextFactory.js` | Singleton-Factory für `AudioContext` (Browser-Limit: 1 pro Seite) |
| `audioSessionService.js` | Mikrofon-Capture-Session (open/close, MediaStream, ScriptProcessor) |
| `microphoneService.js` | Niedrigstufen-Mikrofon-Zugriff (getUserMedia wrapper) |
| `inputLevel.js` | Echtzeit-RMS-Pegelmessung aus AudioBuffer |
| `rms.js` | Reine Funktion: RMS-Berechnung über Float32Array |
| `guitarPitchDetection.js` | Pitch-Detection-Pipeline (YIN + HPS, adaptive FFT) |
| `guitarOnsetDetector.js` | Onset-Detektor-Koordinator (Strategien: XGBoost, Essentia, Simple) |
| `guitarOnsetStrategies.js` | Einzelne Onset-Strategien als austauschbare Module |
| `xgboostFeatureExtractor.js` | ONNX-basierter XGBoost-Feature-Extraktor (Android-Firefox-Modell) |
| `offlineOnsetDetection.js` | Offline-Onset-Erkennung für WAV-Dateien (Test/Tagger) |
| `offlineOnsetDetectionXGBoost.js` | XGBoost-basierte Offline-Onset-Erkennung |
| `liveXGBoostOnsetDetector.js` | Live-Version des XGBoost-Onset-Detektors |
| `onsetPipelineConfig.js` | Konfigurationsschema für Onset-Pipelines |
| `pitchPipelineConfig.js` | Konfigurationsschema für Pitch-Pipelines |
| `fastNoteMatcher.js` | Schneller Noten-Matcher für Streaming-Input |
| `sheetMusicRecognition.js` | Notenblatt-Erkennungs-Pipeline (Onset + Pitch) |
| `essentiaLoader.js` | Lazy-Loader für Essentia WASM |
| `essentiaSheetMusicStrategy.js` | Essentia-basierte Sheet-Music-Strategie |
| `collectFrameData.js` | Frame-Daten für ML-Training sammeln |
| `dbSpectrum.js` | dB-Spektrum-Berechnung |
| `metronomeLogic.js` | Metronom-Logik (BPM, Beat-Counting) |

## Konventionen

- Alle Module exportieren Factories oder reine Funktionen (keine globalen Singletons außer `audioContextFactory`)
- Audio-Module dürfen nicht direkt auf das DOM zugreifen
- Abhängigkeiten auf externe Bibliotheken (ONNX, Essentia) werden lazy geladen
- Tests in `tests/unit/` mit `vitest` (jsdom oder node environment)

## Wichtige Abhängigkeiten

- `js/lib/onnxruntime/ort.min.js` — ONNX Runtime für XGBoost-Inferenz
- `models/onset_detector_android_firefox.onnx` — Default-Onset-Modell
- `js/shared/pwa/precacheManifest.js` — ONNX-Assets müssen hier gecacht sein
