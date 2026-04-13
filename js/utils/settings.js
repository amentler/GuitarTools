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
 * Formats a max-fret value as a human-readable label.
 * @param {number} maxFret
 * @returns {string}
 */
export function formatFretLabel(maxFret) {
  return maxFret === 0 ? 'Nur Leer' : `0 – ${maxFret}`;
}

/**
 * Wires up a fret range slider to update `state.maxFret` and call `onChange`.
 *
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} labelEl
 * @param {{ maxFret: number }} state  – `state.maxFret` is mutated in place.
 * @param {() => void} onChange         – Called after every slider change.
 */
export function wireFretSlider(slider, labelEl, state, onChange) {
  slider.addEventListener('input', () => {
    state.maxFret = parseInt(slider.value, 10);
    labelEl.textContent = formatFretLabel(state.maxFret);
    onChange();
  });
}

/**
 * Syncs a fret slider and its label to the current `maxFret` value.
 *
 * @param {HTMLInputElement} slider
 * @param {HTMLElement} labelEl
 * @param {number} maxFret
 */
export function syncFretSlider(slider, labelEl, maxFret) {
  slider.value = maxFret;
  labelEl.textContent = formatFretLabel(maxFret);
}
