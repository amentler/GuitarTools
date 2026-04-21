// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSheetMusicMicExercise } from '../../js/games/sheetMusicMic/sheetMusicMicExercise.js';

// Mock the dependencies that use external imports or complex DOM
vi.mock('../../js/games/sheetMusicMic/sheetMusicMicSVG.js', () => ({
  renderScoreWithStatus: vi.fn()
}));
vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn()
}));
vi.mock('../../js/games/sheetMusicReading/sheetMusicLogic.js', async () => {
  const actual = await vi.importActual('../../js/games/sheetMusicReading/sheetMusicLogic.js');
  return {
    ...actual,
    generateBars: vi.fn((...args) => actual.generateBars(...args)),
    getFilteredNotes: vi.fn(() => actual.NOTES),
  };
});
vi.mock('../../js/games/sheetMusicMic/fastNoteMatcher.js', async () => {
  const actual = await vi.importActual('../../js/games/sheetMusicMic/fastNoteMatcher.js');
  return {
    ...actual,
    classifyFrame: vi.fn(() => ({
      status: 'correct',
      detectedPitch: 'E4',
      hz: 329.63,
      cents: 0,
    })),
  };
});

const repeatedBars = [[
  { name: 'E', octave: 4, duration: 'q', string: 1, fret: 0 },
  { name: 'E', octave: 4, duration: 'q', string: 1, fret: 0 },
]];

describe('SheetMusicMic Exercise Basic Integration', () => {
  let exercise;

  beforeEach(() => {
    // Mock HTML structure (simplified but with all required IDs)
    document.body.innerHTML = `
      <section id="view-sheet-mic">
        <div id="score-value">0 / 0</div>
        <div id="sheet-mic-score-container"></div>
        <div id="sheet-mic-current-note">–</div>
        <div id="sheet-mic-feedback" class="feedback-text"></div>
        <button id="sheet-mic-start-btn"></button>
        <button id="sheet-mic-stop-btn" style="display:none"></button>
        <button id="sheet-mic-new-bars"></button>
        <p id="sheet-mic-permission" style="display:none"></p>
        <select id="sheet-mic-mode">
          <option value="easy">Einfach</option>
          <option value="hard">Schwer</option>
        </select>
        <input type="range" id="sheet-mic-fret-slider" min="0" max="3" value="3" />
        <span id="sheet-mic-fret-label">0 – 3</span>
        <div id="sheet-mic-string-toggles"></div>
      </section>
    `;

    exercise = createSheetMusicMicExercise();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should initialize without crashing and generate a target note', () => {
    // This tests the resolveUI, wireSettings and generateNewBars path
    // which was previously broken by ID mismatches.
    exercise.startExercise();
    
    const currentNoteEl = document.getElementById('sheet-mic-current-note');
    const feedbackEl = document.getElementById('sheet-mic-feedback');
    
    // Should have generated a note (not the initial '–')
    expect(currentNoteEl.textContent).not.toBe('–');
    expect(currentNoteEl.textContent.length).toBeGreaterThanOrEqual(2); // e.g. "E2"
    
    // Feedback should be empty (not crashed)
    expect(feedbackEl.textContent).toBe('');
  });

  it('should update target note when clicking "New Bars"', () => {
    exercise.startExercise();
    const currentNoteEl = document.getElementById('sheet-mic-current-note');
    
    const firstNote = currentNoteEl.textContent;
    
    // Click "New Bars" multiple times if needed to get a different note 
    // (since it's random, it might stay the same by chance)
    let different = false;
    for (let i = 0; i < 20; i++) {
        document.getElementById('sheet-mic-new-bars').click();
        if (currentNoteEl.textContent !== firstNote) {
            different = true;
            break;
        }
    }
    
    expect(different).toBe(true);
  });

  it('requires a new attack before repeated identical notes advance', async () => {
    vi.useFakeTimers();

    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 44100;
      }
      createAnalyser() {
        return {
          fftSize: 4096,
          connect: vi.fn(),
          getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0.08)),
        };
      }
      createMediaStreamSource() { return { connect: vi.fn() }; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
    });

    const sheetMusicLogic = await import('../../js/games/sheetMusicReading/sheetMusicLogic.js');
    sheetMusicLogic.generateBars.mockReturnValue(repeatedBars);

    exercise.startExercise();
    document.getElementById('sheet-mic-start-btn').click();
    await Promise.resolve();

    vi.advanceTimersByTime(150);

    expect(document.getElementById('score-value').textContent).toBe('1 / 2');
    expect(document.getElementById('sheet-mic-current-note').textContent).toBe('E4');

    vi.advanceTimersByTime(1200);

    expect(document.getElementById('score-value').textContent).toBe('1 / 2');
    expect(document.getElementById('sheet-mic-current-note').textContent).toBe('E4');
    expect(document.getElementById('sheet-mic-feedback').textContent).toBe('');
  });
});
