import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createSheetMusicFeature } from '../../js/games/sheetMusicReading/sheetMusicReading.js';

const root = document.getElementById('view-sheet-music');
if (!root) throw new Error('sheet-music-reading bootstrap: root element #view-sheet-music fehlt');

const feature = createSheetMusicFeature();
feature.mount(root);
