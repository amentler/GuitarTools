export function renderOnsetList(onsetList, onsetsMs, selectedOnsetIndex) {
  if (!onsetList) return;
  onsetList.innerHTML = '';
  if (onsetsMs.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'tagger-onset-empty';
    empty.textContent = 'Noch keine Onsets markiert.';
    onsetList.appendChild(empty);
    return;
  }
  onsetsMs.forEach((ms, i) => {
    const li = document.createElement('li');
    li.className = i === selectedOnsetIndex
      ? 'tagger-onset-item tagger-onset-item--selected'
      : 'tagger-onset-item';
    const selectBtn = document.createElement('button');
    selectBtn.className = 'tagger-onset-select';
    selectBtn.type = 'button';
    selectBtn.setAttribute('data-select-index', i);
    selectBtn.setAttribute('aria-pressed', i === selectedOnsetIndex ? 'true' : 'false');
    selectBtn.textContent = String(i + 1);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'tagger-onset-remove';
    removeBtn.type = 'button';
    removeBtn.setAttribute('data-index', i);
    removeBtn.setAttribute('aria-label', `Onset ${i + 1} entfernen`);
    removeBtn.textContent = 'X';
    li.appendChild(selectBtn);
    li.appendChild(removeBtn);
    onsetList.appendChild(li);
  });
}
