import '../../js/components/index.js';
import { createAkkordfolgenTrainer } from '../../js/games/akkordfolgenTrainer/akkordfolgenTrainer.js';

const root = document.getElementById('view-akkordfolgen-trainer');
if (!root) throw new Error('akkordfolgen-trainer bootstrap: root element #view-akkordfolgen-trainer fehlt');

const feature = createAkkordfolgenTrainer();
feature.mount(root);
