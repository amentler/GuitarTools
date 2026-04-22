import '../../js/components/index.js';
import { createAkkordExercise } from '../../js/games/akkordTrainer/akkordTrainer.js';

const root = document.getElementById('view-akkord-trainer');
if (!root) throw new Error('akkord-trainer bootstrap: root element #view-akkord-trainer fehlt');

const feature = createAkkordExercise();
feature.mount(root);
