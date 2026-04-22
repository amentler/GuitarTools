import '../../js/components/index.js';
import { createGuitarTunerExercise } from '../../js/tools/guitarTuner/guitarTuner.js';

const root = document.getElementById('view-tuner');
if (!root) throw new Error('guitar-tuner bootstrap: root element #view-tuner fehlt');

const tool = createGuitarTunerExercise();
await tool.mount(root);
