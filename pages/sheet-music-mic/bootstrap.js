import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createSheetMusicMicFeature } from '../../js/games/sheetMusicMic/sheetMusicMicExercise.js';

const root = document.getElementById('view-sheet-mic');
if (!root) throw new Error('sheet-music-mic bootstrap: root element #view-sheet-mic fehlt');

const feature = createSheetMusicMicFeature();
feature.mount(root);
