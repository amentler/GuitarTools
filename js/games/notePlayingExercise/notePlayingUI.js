export function resolveNotePlayingUI(rootElement) {
  return {
    permission: rootElement?.querySelector('#note-play-permission'),
    notation: rootElement?.querySelector('#note-play-notation'),
    targetNote: rootElement?.querySelector('#note-play-target'),
    tabContainer: rootElement?.querySelector('#note-play-tab'),
    hint1Btn: rootElement?.querySelector('#note-play-hint1'),
    hint2Btn: rootElement?.querySelector('#note-play-hint2'),
    skipBtn: rootElement?.querySelector('#note-play-skip'),
    detectedNote: rootElement?.querySelector('#note-play-detected'),
    feedback: rootElement?.querySelector('#note-play-feedback'),
    score: rootElement?.querySelector('#score-value'),
    slider: rootElement?.querySelector('#note-play-fret-slider'),
    sliderLabel: rootElement?.querySelector('#note-play-fret-label'),
    stringButtons: rootElement?.querySelectorAll('#note-play-string-toggles .btn-string'),
  };
}
