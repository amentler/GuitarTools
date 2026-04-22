import '../../js/components/index.js';
import { createSheetMusicMicExercise } from '../../js/games/sheetMusicMic/sheetMusicMicExercise.js';

const root = document.getElementById('view-sheet-mic');
if (!root) throw new Error('sheet-music-mic bootstrap: root element #view-sheet-mic fehlt');

const feature = createSheetMusicMicExercise();
feature.mount(root);
