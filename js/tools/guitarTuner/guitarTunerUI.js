export function createRootQuery(getRootElement) {
  return function query(selector) {
    return getRootElement()?.querySelector(selector) ?? null;
  };
}

export function syncModeButtons(query, mode) {
  query('#btn-mode-standard')?.classList.toggle('active', mode === 'standard');
  query('#btn-mode-chromatic')?.classList.toggle('active', mode === 'chromatic');
}

export function resetGuidedPanels(query) {
  const elBtnStart = query('#btn-start-guided');
  const elActive = query('#guided-active');
  const elFinished = query('#guided-finished');
  if (elBtnStart) elBtnStart.style.display = '';
  if (elActive) elActive.style.display = 'none';
  if (elFinished) elFinished.style.display = 'none';
}

export function showGuidedActive(query) {
  query('#btn-start-guided').style.display = 'none';
  query('#guided-active').style.display = '';
  query('#guided-finished').style.display = 'none';
}

export function showGuidedFinished(query) {
  query('#guided-active').style.display = 'none';
  query('#guided-finished').style.display = '';
}

export function renderGuidedStep(query, steps, stepIndex) {
  const step = steps[stepIndex];
  query('#guided-step-label').textContent = `${step.stringNumber}. Saite`;
  query('#guided-step-target').textContent = `${step.note}${step.octave}`;

  const progress = query('#guided-step-progress');
  progress.innerHTML = '';
  for (let i = 0; i < steps.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'guided-progress-dot'
      + (i === stepIndex ? ' active' : '')
      + (i < stepIndex ? ' done' : '');
    progress.appendChild(dot);
  }
}

export function renderGuidedFeedback(query, display) {
  const container = query('#guided-feedback');
  if (!container) return;
  container.innerHTML = '';

  if (!display || display.type === null) return;

  if (display.type === 'green') {
    const okEl = document.createElement('div');
    okEl.className = 'guided-ok';
    okEl.textContent = '●';
    container.appendChild(okEl);

    const textEl = document.createElement('div');
    textEl.className = 'guided-hint guided-hint--ok';
    textEl.textContent = 'Perfekt';
    container.appendChild(textEl);
    return;
  }

  if (display.warning) {
    const warnEl = document.createElement('div');
    warnEl.className = 'guided-warning';
    warnEl.textContent = '⚠ Falsche Richtung!';
    container.appendChild(warnEl);
  }

  const arrowEl = document.createElement('div');
  arrowEl.className = `guided-arrow ${display.arrowColor}`;
  arrowEl.textContent = display.direction === 'up' ? '↑' : '↓';
  container.appendChild(arrowEl);

  const hintEl = document.createElement('div');
  hintEl.className = 'guided-hint';
  hintEl.textContent = display.direction === 'up'
    ? 'Ton zu tief – höher stimmen'
    : 'Ton zu hoch – tiefer stimmen';
  container.appendChild(hintEl);
}
