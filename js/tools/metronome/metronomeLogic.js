/**
 * Metronome Logic using Web Audio API for high-precision timing.
 * Follows the "Scheduling Web Audio with Precision" pattern.
 */

export class MetronomeLogic {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.bpm = 120;
    this.beatsPerMeasure = 4;
    this.currentBeat = 0;
    this.lookahead = 25.0; // How frequently to call scheduler (in ms)
    this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)
    this.nextNoteTime = 0.0; // When the next note is due
    this.timerID = null;
    this.onBeat = null; // Callback for UI updates
    this.onBeatAdvanceSeconds = 0; // Positive value fires UI callback slightly before audio tick
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  nextNote() {
    // Advance current note and time by a beat
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;

    this.currentBeat++;
    if (this.currentBeat >= this.beatsPerMeasure) {
      this.currentBeat = 0;
    }
  }

  scheduleNote(beatNumber, time) {
    // Create an oscillator
    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    // High pitch for beat 0, lower for others
    osc.frequency.value = beatNumber === 0 ? 1000 : 800;

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.1);

    // Trigger UI update callback
    if (this.onBeat) {
      // Use setTimeout to sync with audio as closely as possible
      const rawDelay = (time - this.audioContext.currentTime - this.onBeatAdvanceSeconds) * 1000;
      const delay = Math.max(0, rawDelay);
      setTimeout(() => {
        if (this.isPlaying && this.onBeat) {
          this.onBeat(beatNumber);
        }
      }, delay);
    }
  }

  scheduler() {
    // While there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  start() {
    if (this.isPlaying) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.audioContext.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerID);
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }

  setBeatsPerMeasure(beats) {
    this.beatsPerMeasure = beats;
  }

  setOnBeatAdvanceSeconds(seconds) {
    this.onBeatAdvanceSeconds = Math.max(0, Number(seconds) || 0);
  }
}
