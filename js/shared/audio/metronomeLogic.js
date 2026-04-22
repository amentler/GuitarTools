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
    this.lookahead = 25.0;
    this.scheduleAheadTime = 0.1;
    this.nextNoteTime = 0.0;
    this.timerID = null;
    this.onBeat = null;
    this.onBeatAdvanceSeconds = 0;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;

    this.currentBeat++;
    if (this.currentBeat >= this.beatsPerMeasure) {
      this.currentBeat = 0;
    }
  }

  scheduleNote(beatNumber, time) {
    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.frequency.value = beatNumber === 0 ? 1000 : 800;

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.1);

    if (this.onBeat) {
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
