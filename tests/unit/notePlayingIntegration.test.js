// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotePlayingExerciseFeature } from '../../js/games/notePlayingExercise/notePlayingExercise.js';

// Mock dependencies that might fail in JSDOM/Node
vi.mock('../../js/games/notePlayingExercise/notePlayingSVG.js', () => ({
  renderNoteOnStaff: vi.fn(),
  renderNotePositionsTab: vi.fn()
}));
vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn()
}));

describe('NotePlayingExercise Skip Button Integration', () => {
  let exercise;

  beforeEach(() => {
    // Mock HTML structure
    document.body.innerHTML = `
      <section id="view-note-play">
        <div id="score-value">0</div>
        <div id="note-play-permission"></div>
        <div id="note-play-notation"></div>
        <p id="note-play-target">–</p>
        <div id="note-play-tab"></div>
        <button id="note-play-hint1"></button>
        <button id="note-play-hint2"></button>
        <div id="note-play-detected"></div>
        <p id="note-play-feedback"></p>
        <input type="range" id="note-play-fret-slider" />
        <span id="note-play-fret-label"></span>
        <div id="note-play-string-toggles"></div>
        <!-- This is the button we want to add -->
        <button id="note-play-skip">Weiter</button>
      </section>
    `;

    // Mock AudioContext to avoid startup failure
    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 44100;
      }
      createAnalyser() { return { fftSize: 2048, connect: vi.fn(), getFloatTimeDomainData: vi.fn() }; }
      createMediaStreamSource() { return { connect: vi.fn() }; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    // Mock MediaDevices
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
      }
    });

    exercise = createNotePlayingExerciseFeature();
  });

  it('should change the target note when the skip button is clicked', async () => {
    exercise.startExercise();
    const targetNoteEl = document.getElementById('note-play-target');
    const initialNote = targetNoteEl.textContent;
    expect(initialNote).not.toBe('–');

    const skipBtn = document.getElementById('note-play-skip');
    expect(skipBtn).not.toBeNull();

    // Click skip multiple times to ensure we get a different note (random)
    let different = false;
    for (let i = 0; i < 20; i++) {
      skipBtn.click();
      if (targetNoteEl.textContent !== initialNote) {
        different = true;
        break;
      }
    }

    expect(different).toBe(true);
  });
});
