// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const detectChordEssentia = vi.fn();
const stopListeningEssentia = vi.fn();
const getEssentia = vi.fn();
const getRandomChord = vi.fn();

vi.mock('../../js/games/chordExerciseEssentia/essentiaChordDetection.js', () => ({
  detectChordEssentia,
  stopListeningEssentia,
}));

vi.mock('../../js/games/chordExerciseEssentia/essentiaLoader.js', () => ({
  getEssentia,
}));

vi.mock('../../js/shared/rendering/chords/chordDiagramRenderer.js', () => ({
  renderChordDiagram: vi.fn(),
}));

vi.mock('../../js/domain/chords/chordCatalog.js', () => ({
  getRandomChord,
}));

const chordA = { name: 'C-Dur', positions: [null, 3, 2, 0, 1, 0] };
const chordB = { name: 'G-Dur', positions: [3, 2, 0, 0, 0, 3] };

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function setupDom() {
  document.body.innerHTML = `
    <section id="view-chord-exercise-essentia" class="view active">
      <h2 id="ece-chord-name"></h2>
      <div id="ece-chord-diagram"></div>
      <p id="ece-essentia-status"></p>
      <p id="feedback-text"></p>
      <button id="btn-ece-listen">Weiter</button>
      <span id="score-correct"></span>
      <span id="score-total"></span>
      <input type="checkbox" id="ece-cat-simplified" checked>
      <input type="checkbox" id="ece-cat-standard">
      <input type="checkbox" id="ece-cat-extended">
      <input type="checkbox" id="ece-cat-sus-add">
    </section>
  `;
}

async function letPromisesSettle() {
  await Promise.resolve();
  await Promise.resolve();
}

async function advance(ms = 1) {
  await vi.advanceTimersByTimeAsync(ms);
  await letPromisesSettle();
}

describe('chordExerciseEssentia controller', () => {
  let createChordExerciseEssentia;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    setupDom();
    getEssentia.mockResolvedValue({});
    ({ createChordExerciseEssentia } = await import('../../js/games/chordExerciseEssentia/chordExerciseEssentia.js'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('startet automatisch, zeigt Erfolg! und wechselt zeitnah weiter', async () => {
    const firstDetection = deferred();
    const secondDetection = deferred();
    detectChordEssentia
      .mockReturnValueOnce(firstDetection.promise)
      .mockReturnValueOnce(secondDetection.promise);
    getRandomChord
      .mockReturnValueOnce(chordA)
      .mockReturnValueOnce(chordB);

    const feature = createChordExerciseEssentia();
    feature.mount();

    await letPromisesSettle();
    await advance();

    expect(document.getElementById('btn-ece-listen').disabled).toBe(false);
    expect(detectChordEssentia).toHaveBeenCalledWith('C-Dur');

    firstDetection.resolve({ isCorrect: true, confidence: 1, bestMatch: 'C-Dur' });
    await letPromisesSettle();

    expect(document.getElementById('feedback-text').textContent).toBe('Erfolg!');
    expect(document.getElementById('score-correct').textContent).toBe('1');
    expect(document.getElementById('score-total').textContent).toBe('1');

    await advance(500);
    expect(document.getElementById('ece-chord-name').textContent).toBe('G-Dur');

    await advance();
    expect(detectChordEssentia).toHaveBeenLastCalledWith('G-Dur');
  });

  it('wiederholt einen falschen Akkord statt weiterzuspringen', async () => {
    const firstDetection = deferred();
    const retryDetection = deferred();
    detectChordEssentia
      .mockReturnValueOnce(firstDetection.promise)
      .mockReturnValueOnce(retryDetection.promise);
    getRandomChord.mockReturnValue(chordA);

    const feature = createChordExerciseEssentia();
    feature.mount();

    await letPromisesSettle();
    await advance();

    firstDetection.resolve({ isCorrect: false, confidence: 0.2, bestMatch: 'D-Dur' });
    await advance();

    expect(document.getElementById('ece-chord-name').textContent).toBe('C-Dur');
    expect(document.getElementById('feedback-text').textContent).toContain('Nicht erkannt');

    await advance(250);
    expect(document.getElementById('ece-chord-name').textContent).toBe('C-Dur');
    expect(detectChordEssentia).toHaveBeenCalledTimes(2);
    expect(detectChordEssentia).toHaveBeenLastCalledWith('C-Dur');
  });

  it('laesst Weiter immer aktiv und startet danach den naechsten Akkord', async () => {
    const firstDetection = deferred();
    const secondDetection = deferred();
    detectChordEssentia
      .mockReturnValueOnce(firstDetection.promise)
      .mockReturnValueOnce(secondDetection.promise);
    getRandomChord
      .mockReturnValueOnce(chordA)
      .mockReturnValueOnce(chordB);

    const feature = createChordExerciseEssentia();
    feature.mount();

    await letPromisesSettle();
    await advance();

    const nextButton = document.getElementById('btn-ece-listen');
    expect(nextButton.textContent).toBe('Weiter');
    expect(nextButton.disabled).toBe(false);
    expect(detectChordEssentia).toHaveBeenCalledWith('C-Dur');

    nextButton.click();

    expect(stopListeningEssentia).toHaveBeenCalledTimes(1);
    expect(document.getElementById('ece-chord-name').textContent).toBe('G-Dur');

    await advance(0);
    expect(detectChordEssentia).toHaveBeenLastCalledWith('G-Dur');
  });
});
