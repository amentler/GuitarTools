import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createChordPlayingFeature } from '../../js/games/chordExerciseEssentia/chordExerciseEssentia.js';

const root = document.getElementById('view-chord-exercise-essentia');
if (!root) throw new Error('chord-playing-essentia bootstrap: root element #view-chord-exercise-essentia fehlt');

const feature = createChordPlayingFeature();
feature.mount(root);
