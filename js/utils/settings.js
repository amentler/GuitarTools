/**
 * Shared settings utilities for fret range sliders and string toggle buttons.
 * Used by: fretboard, ton-finder, sheet-music, sheet-mic, note-play exercises.
 *
 * Eliminates ~175 lines of duplicated wiring code across 5 exercise files.
 */

// ── String Toggle Buttons ────────────────────────────────────────────────────

/**
 * Wires up string toggle buttons to an `activeStrings` array.
 * Each button must have a `data-string` attribute with the string index (0–5).
 *
 * @param {NodeListOf<HTMLButtonElement>} buttons
 * @param {number[]} activeStrings  – Mutated in place (splice/push/sort).
 * @param {() => void} onChange      – Called after every toggle.
 */
export function wireStringToggles(buttons, activeStrings, onChange) {
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.string, 10);
      if (activeStrings.includes(idx)) {
        if (activeStrings.length > 1) {
          activeStrings.splice(activeStrings.indexOf(idx), 1);
          btn.classList.remove('active');
        }
      } else {
        activeStrings.push(idx);
        activeStrings.sort((a, b) => a - b);
        btn.classList.add('active');
      }
      onChange();
    });
  });
}

/**
 * Syncs the active state of string toggle buttons to the `activeStrings` array.
 *
 * @param {NodeListOf<HTMLButtonElement>} buttons
 * @param {number[]} activeStrings
 */
export function syncStringToggles(buttons, activeStrings) {
  buttons.forEach(btn => {
    const idx = parseInt(btn.dataset.string, 10);
    btn.classList.toggle('active', activeStrings.includes(idx));
  });
}

// ── Fret Range Slider ────────────────────────────────────────────────────────

/**
 * Formats a fret range as a human-readable label.
 * @param {number} minFret
 * @param {number} maxFret
 * @returns {string}
 */
export function formatFretRangeLabel(minFret, maxFret) {
  if (minFret === 0 && maxFret === 0) return 'Nur Leer';
  if (minFret === 0) return `0 – ${maxFret}`;
  return `${minFret} – ${maxFret}`;
}

/**
 * Formats a max-fret value as a human-readable label.
 * @param {number} maxFret
 * @returns {string}
 * @deprecated Use formatFretRangeLabel(0, maxFret) instead.
 */
export function formatFretLabel(maxFret) {
  return formatFretRangeLabel(0, maxFret);
}

/**
 * Wires up a fret range slider to update `state.maxFret` and call `onChange`.
 * When a `minSlider` is provided, enforces that minFret <= maxFret.
 *
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} labelEl
 * @param {{ maxFret: number, minFret?: number }} state  – `state.maxFret` is mutated in place.
 * @param {() => void} onChange         – Called after every slider change.
 * @param {HTMLInputElement|null} [minSlider] – Optional min-fret slider for mutual clamping.
 */
export function wireFretSlider(slider, labelEl, state, onChange, minSlider = null) {
  slider.addEventListener('input', () => {
    state.maxFret = parseInt(slider.value, 10);
    if (minSlider !== null && state.maxFret < state.minFret) {
      state.minFret = state.maxFret;
      minSlider.value = state.maxFret;
    }
    const label = formatFretRangeLabel(state.minFret ?? 0, state.maxFret);
    labelEl.textContent = label;
    onChange();
  });
}

/**
 * Wires up a min-fret slider to update `state.minFret` and call `onChange`.
 * Enforces that minFret <= maxFret (clamps and updates maxSlider if needed).
 *
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} labelEl
 * @param {{ minFret: number, maxFret: number }} state
 * @param {HTMLInputElement} maxSlider  – The max-fret slider for mutual clamping.
 * @param {() => void} onChange
 */
export function wireMinFretSlider(slider, labelEl, state, maxSlider, onChange) {
  slider.addEventListener('input', () => {
    state.minFret = parseInt(slider.value, 10);
    if (state.minFret > state.maxFret) {
      state.maxFret = state.minFret;
      maxSlider.value = state.minFret;
    }
    labelEl.textContent = formatFretRangeLabel(state.minFret, state.maxFret);
    onChange();
  });
}

/**
 * Syncs a fret slider and its label to the current fret range values.
 *
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} labelEl
 * @param {number} maxFret
 * @param {number} [minFret=0]
 */
export function syncFretSlider(slider, labelEl, maxFret, minFret = 0) {
  slider.value = maxFret;
  labelEl.textContent = formatFretRangeLabel(minFret, maxFret);
}

/**
 * Syncs a min-fret slider element (value only; label is updated by syncFretSlider).
 *
 * @param {HTMLInputElement} slider
 * @param {number} minFret
 */
export function syncMinFretSlider(slider, minFret) {
  slider.value = minFret;
}
