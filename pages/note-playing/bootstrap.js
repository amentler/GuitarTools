import '../../js/components/index.js';
import { createNotePlayingExercise } from '../../js/games/notePlayingExercise/notePlayingExercise.js';

const root = document.getElementById('view-note-play');

if (!root) {
  throw new Error('note-playing bootstrap: root element #view-note-play fehlt');
}

const feature = createNotePlayingExercise();

await feature.mount(root);
