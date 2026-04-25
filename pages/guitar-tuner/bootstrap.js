import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createGuitarTunerTool } from '../../js/tools/guitarTuner/guitarTuner.js';

const root = document.getElementById('view-tuner');
if (!root) throw new Error('guitar-tuner bootstrap: root element #view-tuner fehlt');

const tool = createGuitarTunerTool();
await tool.mount(root);
