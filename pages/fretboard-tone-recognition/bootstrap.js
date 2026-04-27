import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createFretboardToneRecognitionFeature } from '../../js/games/fretboardToneRecognition/fretboardExercise.js';

const root = document.getElementById('view-fretboard');
if (!root) throw new Error('fretboard-tone-recognition bootstrap: root element #view-fretboard fehlt');

const feature = createFretboardToneRecognitionFeature();
feature.mount(root);
