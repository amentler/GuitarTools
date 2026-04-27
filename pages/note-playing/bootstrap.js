import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createNotePlayingExerciseFeature } from '../../js/games/notePlayingExercise/notePlayingExercise.js';

const root = document.getElementById('view-note-play');

if (!root) {
  throw new Error('note-playing bootstrap: root element #view-note-play fehlt');
}

const feature = createNotePlayingExerciseFeature();

await feature.mount(root);
