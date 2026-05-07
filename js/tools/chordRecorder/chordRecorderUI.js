import { chordStringToFretboardIndex } from '../../domain/chords/chordFretboardMapping.js';

export function createChordRecorderUI(container) {
  const _queue = [];
  let _waitResolve = null;

  function _fireAction(action) {
    if (_waitResolve) {
      const fn = _waitResolve;
      _waitResolve = null;
      fn(action);
    } else {
      _queue.push(action);
    }
  }

  function nextAction() {
    if (_queue.length > 0) return Promise.resolve(_queue.shift());
    return new Promise(resolve => { _waitResolve = resolve; });
  }

  function clearQueue() {
    _queue.length = 0;
  }

  function render(chordName, positions, variation, index, total) {
    const { technik, lautstaerke, strumModus, repeatIndex } = variation;
    const variationLabel = `${technik} · ${lautstaerke} · ${strumModus} (${repeatIndex}/2)`;

    container.innerHTML = `
      <div class="cr-rec-screen">
        <div class="cr-rec-header">
          <span class="cr-rec-progress">${index + 1} / ${total}</span>
          <span class="cr-rec-chord-name">${chordName}</span>
          <span class="cr-rec-variation">${variationLabel}</span>
        </div>

        <div class="cr-rec-fretboard"></div>

        <div class="cr-level-wrap">
          <div id="cr-level-bar" class="cr-level-bar"></div>
        </div>

        <div class="cr-rec-display">
          <div id="cr-countdown" class="cr-countdown"></div>
          <div id="cr-status" class="cr-status-text"></div>
        </div>

        <div id="cr-result" class="cr-result u-hidden"></div>

        <div id="cr-auto-advance" class="cr-auto-advance u-hidden">
          <span class="cr-auto-label">Weiter in</span>
          <strong id="cr-auto-num"></strong>
          <button type="button" id="cr-pause-btn" class="cr-btn cr-btn--pause" data-action="pause">⏸</button>
        </div>

        <div class="cr-rec-controls">
          <button type="button" class="cr-btn cr-btn--stop"   data-action="stop">⛔ Stop</button>
          <button type="button" class="cr-btn cr-btn--repeat" data-action="repeat">↩ Wiederholen</button>
          <button type="button" class="cr-btn cr-btn--next"   data-action="next">⏭ Weiter</button>
          <button type="button" class="cr-btn cr-btn--flag"   data-action="buzz">Schnarren</button>
          <button type="button" class="cr-btn cr-btn--flag"   data-action="muted">Muted</button>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => _fireAction(btn.dataset.action));
    });

    if (positions) {
      const fbContainer = container.querySelector('.cr-rec-fretboard');
      const fb = document.createElement('gt-fretboard');
      fb.setAttribute('frets', '5');
      fb.positions = positions.map(p => ({
        stringIndex: chordStringToFretboardIndex(p.string),
        fret: p.muted ? 0 : p.fret,
        state: p.muted ? 'muted' : 'selected',
        label: p.finger ? String(p.finger) : null,
      }));
      fbContainer.appendChild(fb);
    }
  }

  function setLevel(rms) {
    const el = container.querySelector('#cr-level-bar');
    if (!el) return;
    const pct = Math.min(100, Math.round(rms * 150));
    el.style.width = `${pct}%`;
    const cls = pct >= 85 ? 'clip' : pct >= 65 ? 'warn' : '';
    el.className = `cr-level-bar${cls ? ` ${cls}` : ''}`;
  }

  function setPhase(phase, num = null) {
    const cdEl = container.querySelector('#cr-countdown');
    const stEl = container.querySelector('#cr-status');
    if (!cdEl || !stEl) return;
    cdEl.textContent = num !== null ? String(num) : '';
    stEl.textContent = phase === 'listening' ? 'Warte auf Anschlag…'
      : phase === 'recording' ? 'Aufnahme läuft…'
      : phase === 'ended' ? 'Aufnahme beendet'
      : '';
  }

  function showBeats(totalBeats) {
    const cdEl = container.querySelector('#cr-countdown');
    const stEl = container.querySelector('#cr-status');
    if (!cdEl) return;
    cdEl.innerHTML = `<div class="cr-beat-row">${
      Array.from({ length: totalBeats }, (_, i) =>
        `<div class="cr-beat-dot${i % 4 === 0 ? ' downbeat' : ''}" data-beat="${i + 1}"></div>`
      ).join('')
    }</div>`;
    if (stEl) stEl.textContent = 'Aufnahme läuft…';
  }

  function setBeat(n) {
    container.querySelectorAll('.cr-beat-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 === n);
    });
  }

  function showResult(quality) {
    const el = container.querySelector('#cr-result');
    if (!el) return;
    el.classList.remove('u-hidden');
    if (quality.passed) {
      const warn = quality.warnReasons.length
        ? ` <span class="cr-result-warn">⚠ ${quality.warnReasons.join(', ')}</span>` : '';
      el.innerHTML = `<span class="cr-result-pass">✓ OK</span>${warn}`;
    } else {
      el.innerHTML = `<span class="cr-result-fail">✗ ${quality.failReasons.join(', ')}</span>`;
    }
  }

  function setAutoCountdown(n, paused) {
    const wrap = container.querySelector('#cr-auto-advance');
    const numEl = container.querySelector('#cr-auto-num');
    const btn   = container.querySelector('#cr-pause-btn');
    if (!wrap || !numEl || !btn) return;
    wrap.classList.remove('u-hidden');
    numEl.textContent = n;
    btn.textContent = paused ? '▶' : '⏸';
    btn.title = paused ? 'Fortfahren' : 'Pause';
  }

  function hideAutoCountdown() {
    container.querySelector('#cr-auto-advance')?.classList.add('u-hidden');
  }

  return {
    render, setLevel, setPhase, showBeats, setBeat,
    showResult, setAutoCountdown, hideAutoCountdown,
    nextAction, clearQueue,
  };
}
