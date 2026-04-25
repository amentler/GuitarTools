import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createAkkordTrainerFeature } from '../../js/games/akkordTrainer/akkordTrainer.js';

const root = document.getElementById('view-akkord-trainer');
if (!root) throw new Error('akkord-trainer bootstrap: root element #view-akkord-trainer fehlt');

const feature = createAkkordTrainerFeature();
feature.mount(root);
