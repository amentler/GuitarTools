/**
 * chordExerciseEssentia.js
 * Exercise controller for "Akkord spielen (Essentia)" –
 * same flow as chordExercise.js but uses HPCP-based recognition.
 */

import { getRandomChord } from '../../domain/chords/chordCatalog.js';
import { chordStringToFretboardIndex } from '../../domain/chords/chordFretboardMapping.js';
import { detectChordEssentia, stopListeningEssentia } from './essentiaChordDetection.js';
import { getEssentia } from './essentiaLoader.js';
import { CHORDS, CHORD_CATEGORIES } from '../../data/akkordData.js';

// ── Factory ───────────────────────────────────────────────────────────────────

export function createChordExerciseEssentiaFeature() {
  let currentChord   = null;
  let score          = { correct: 0, total: 0 };
  let pendingTimer   = null;
  let autoListenTimer = null;
  let feedbackClearTimer = null;
  let isListening    = false;
  let essentiaReady  = false;
  let flowToken      = 0;

  const SUCCESS_ADVANCE_DELAY_MS = 500;
  const RETRY_DELAY_MS = 250;
  const FEEDBACK_VISIBLE_MS = 3000;

  const CATEGORIES = {
    'ece-cat-simplified': 'simplified',
    'ece-cat-standard':   'standard',
    'ece-cat-extended':   'extended',
    'ece-cat-sus-add':    'sus_add',
  };

  function getActiveCategories() {
    const active = [];
    for (const id of Object.keys(CATEGORIES)) {
      const cb = document.getElementById(id);
      if (cb?.checked) active.push(CATEGORIES[id]);
    }
    return active.length ? active : ['simplified'];
  }

  function getForcedRoundConfig() {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const chord = params.get('chord');
    if (!chord || !CHORDS[chord]) return null;

    const categoriesParam = params.get('categories');
    const categories = categoriesParam
      ? categoriesParam
        .split(',')
        .map(v => v.trim())
        .filter(v => CHORD_CATEGORIES[v])
      : null;

    return { chord, categories };
  }

  // ── DOM references ─────────────────────────────────────────────────────────

  let ui = null;

  function resolveUI() {
    ui = {
      chordName:    document.getElementById('ece-chord-name'),
      diagramEl:    document.getElementById('ece-chord-fretboard'),
      feedbackEl:   document.getElementById('feedback-text'),
      statusEl:     document.getElementById('ece-essentia-status'),
      listenBtn:    document.getElementById('btn-ece-listen'),
      scoreCorrect: document.getElementById('score-correct'),
      scoreTotal:   document.getElementById('score-total'),
      view:         document.getElementById('view-chord-exercise-essentia'),
    };
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function drawChordDiagram() {
    if (!currentChord || !ui.diagramEl) return;
    ui.diagramEl.positions = currentChord.positions.map(p => ({
      stringIndex: chordStringToFretboardIndex(p.string),
      fret: p.muted ? 0 : p.fret,
      state: p.muted ? 'muted' : 'selected',
      label: p.finger ? String(p.finger) : null
    }));
  }

  function updateScoreUI() {
    if (ui.scoreCorrect) ui.scoreCorrect.textContent = score.correct;
    if (ui.scoreTotal)   ui.scoreTotal.textContent   = score.total;
  }

  function setStatus(text, isError = false) {
    if (!ui.statusEl) return;
    ui.statusEl.textContent = text;
    ui.statusEl.className   = isError ? 'ece-status ece-status-error' : 'ece-status';
  }

  // ── Round management ───────────────────────────────────────────────────────

  function clearPendingTimer() {
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  function clearAutoListenTimer() {
    if (autoListenTimer !== null) { clearTimeout(autoListenTimer); autoListenTimer = null; }
  }

  function clearFeedbackTimer() {
    if (feedbackClearTimer !== null) { clearTimeout(feedbackClearTimer); feedbackClearTimer = null; }
  }

  function scheduleAutoListen(token, delay = 0) {
    clearAutoListenTimer();
    if (!essentiaReady || !currentChord || !ui.view?.classList.contains('active')) return;

    autoListenTimer = setTimeout(() => {
      autoListenTimer = null;
      handleListen(token);
    }, delay);
  }

  function nextRound({ cancelActive = false } = {}) {
    clearPendingTimer();
    clearAutoListenTimer();
    clearFeedbackTimer();
    flowToken++;
    const token = flowToken;
    if (cancelActive && isListening) stopListeningEssentia();
    isListening  = false;
    const forcedRound = getForcedRoundConfig();
    if (forcedRound) {
      currentChord = {
        name: forcedRound.chord,
        positions: CHORDS[forcedRound.chord],
      };
    } else {
      currentChord = getRandomChord(getActiveCategories());
    }

    if (ui.chordName)  ui.chordName.textContent = currentChord.name;
    if (ui.feedbackEl) { ui.feedbackEl.textContent = ''; ui.feedbackEl.className = 'feedback-text'; }
    if (ui.listenBtn)  {
      ui.listenBtn.textContent = 'Weiter';
      ui.listenBtn.disabled = false;
    }

    if (forcedRound?.categories) {
      for (const [id, category] of Object.entries(CATEGORIES)) {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = forcedRound.categories.includes(category);
      }
    }

    drawChordDiagram();
    scheduleAutoListen(token);
  }

  // ── Listening flow ─────────────────────────────────────────────────────────

  async function handleListen(token = flowToken) {
    if (token !== flowToken || isListening || !currentChord) return;
    isListening = true;

    if (ui.statusEl) setStatus('Warte auf Anschlag\u2026');

    let result;
    try {
      result = await detectChordEssentia(currentChord.name);
    } catch {
      result = { isCorrect: false, confidence: 0, bestMatch: null, essentiaError: true };
    }

    if (token !== flowToken) return;
    isListening = false;
    if (!ui.view?.classList.contains('active')) return;

    showFeedback(result, token);
  }

  function showFeedback(result, token = flowToken) {
    setStatus('');
    clearFeedbackTimer();

    // Helper to start the auto-clear timer
    const startClearTimer = () => {
      feedbackClearTimer = setTimeout(() => {
        feedbackClearTimer = null;
        if (ui.feedbackEl) {
          ui.feedbackEl.textContent = '';
          ui.feedbackEl.className = 'feedback-text';
        }
      }, FEEDBACK_VISIBLE_MS);
    };

    // Essentia unavailable — show error but do not count as attempt
    if (result.essentiaError) {
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = 'Essentia nicht verf\u00FCgbar. Bitte Seite neu laden.';
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }
      return;
    }

    score.total++;
    updateScoreUI();

    if (result.timedOut) {
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = 'Kein Anschlag erkannt. Versuche es nochmal.';
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }
      startClearTimer();
      scheduleAutoListen(token, RETRY_DELAY_MS);
      return;
    }

    if (result.isCorrect) {
      score.correct++;
      updateScoreUI();
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = 'Erfolg!';
        ui.feedbackEl.className   = 'feedback-text feedback-correct';
      }
      // No startClearTimer here, because nextRound() will clear it anyway after success delay
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (ui.view?.classList.contains('active')) nextRound();
      }, SUCCESS_ADVANCE_DELAY_MS);
    } else {
      const pct = Math.round((result.confidence ?? 0) * 100);
      const hint = result.bestMatch && result.bestMatch !== currentChord.name
        ? ` (erkannt: ${result.bestMatch})`
        : '';
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = `\u274C Nicht erkannt \u2013 \u00DCbereinstimmung: ${pct}%${hint}`;
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }
      startClearTimer();
      scheduleAutoListen(token, RETRY_DELAY_MS);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function mount() {
    resolveUI();
    score         = { correct: 0, total: 0 };
    essentiaReady = false;
    updateScoreUI();

    if (ui.listenBtn) {
      const fresh = ui.listenBtn.cloneNode(true);
      ui.listenBtn.replaceWith(fresh);
      ui.listenBtn = fresh;
      ui.listenBtn.addEventListener('click', () => nextRound({ cancelActive: true }));
      ui.listenBtn.textContent = 'Weiter';
      ui.listenBtn.disabled = false;
    }

    // Pre-warm essentia WASM. Enable "Hören" regardless of outcome:
    // on WASM failure the detection falls back to pure-JS HPCP automatically.
    setStatus('Lade Essentia\u2026');
    getEssentia()
      .then(() => {
        if (!ui.view?.classList.contains('active')) return;
        essentiaReady = true;
        setStatus('');
        scheduleAutoListen(flowToken);
      })
      .catch(err => {
        if (!ui.view?.classList.contains('active')) return;
        essentiaReady = true; // pure-JS fallback is active
        const reason = err?.message ? `: ${err.message}` : '';
        setStatus(`Basis-Modus (WASM nicht verf\u00FCgbar${reason}).`);
        scheduleAutoListen(flowToken);
      });

    nextRound();
  }

  function unmount() {
    clearPendingTimer();
    clearAutoListenTimer();
    clearFeedbackTimer();
    flowToken++;
    isListening = false;
    stopListeningEssentia();
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
