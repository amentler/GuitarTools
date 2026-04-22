import '../../js/components/index.js';
import { createChordExerciseEssentia } from '../../js/games/chordExerciseEssentia/chordExerciseEssentia.js';

const root = document.getElementById('view-chord-exercise-essentia');
if (!root) throw new Error('chord-playing-essentia bootstrap: root element #view-chord-exercise-essentia fehlt');

const feature = createChordExerciseEssentia();
feature.mount(root);
