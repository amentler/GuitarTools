import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createMetronomeFeature } from '../../js/tools/metronome/metronome.js';

const root = document.getElementById('view-metronome');
if (!root) throw new Error('metronome bootstrap: root element #view-metronome fehlt');

const feature = createMetronomeFeature();
feature.mount(root);
