import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';
import { openAudioSession, closeAudioSession } from '../../shared/audio/audioSessionService.js';
import { enumerateAndShowMics } from './sheetMusicReadingUI.js';
import { ONSET_FFT_SIZE, ONSET_LIVE_ANALYZE_INTERVAL_MS } from '../../shared/audio/onsetPipelineConfig.js';

export function createListeningController({
  state, audioSession, getUI, onAnalyzeFrame, onApplyFftSize, onClearSuccessTimeout,
}) {
  let analyzeIntervalId = null;

  async function stopListening() {
    clearInterval(analyzeIntervalId);
    analyzeIntervalId = null;
    onClearSuccessTimeout();
    state.isListening = false;
    await closeAudioSession(audioSession, {
      reset: session => { session.currentFftSize = 0; },
    });
  }

  async function startListening() {
    if (state.isListening || !state.active) return;
    const ui = getUI();
    ui.permission.classList.remove('u-hidden');
    ui.permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

    let microphoneStream;
    try {
      const audioConstraints = {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
      };
      if (state.selectedMicDeviceId) {
        audioConstraints.deviceId = { ideal: state.selectedMicDeviceId };
      }
      microphoneStream = await requestMicrophoneStream({
        constraints: { audio: audioConstraints, video: false },
      });
    } catch {
      ui.permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
      return;
    }

    try {
      await openAudioSession(audioSession, {
        stream: microphoneStream,
        fftSize: ONSET_FFT_SIZE,
        AudioContextCtor: AudioContext,
      });
    } catch {
      ui.permission.classList.remove('u-hidden');
      ui.permission.textContent = 'Audio-Kontext konnte nicht gestartet werden. Bitte Seite neu laden.';
      return;
    }

    ui.permission.classList.add('u-hidden');
    state.isListening = true;
    onApplyFftSize();
    analyzeIntervalId = setInterval(onAnalyzeFrame, ONSET_LIVE_ANALYZE_INTERVAL_MS);
    void enumerateAndShowMics(ui);
  }

  return { startListening, stopListening };
}
