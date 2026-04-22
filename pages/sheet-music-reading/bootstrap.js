import '../../js/components/index.js';
import { createSheetMusicExercise } from '../../js/games/sheetMusicReading/sheetMusicReading.js';

const root = document.getElementById('view-sheet-music');
if (!root) throw new Error('sheet-music-reading bootstrap: root element #view-sheet-music fehlt');

const feature = createSheetMusicExercise();
feature.mount(root);
