import '../../js/components/index.js';
import { createFretboardExercise } from '../../js/games/fretboardToneRecognition/fretboardExercise.js';

const root = document.getElementById('view-fretboard');
if (!root) throw new Error('fretboard-tone-recognition bootstrap: root element #view-fretboard fehlt');

const feature = createFretboardExercise();
feature.mount(root);
