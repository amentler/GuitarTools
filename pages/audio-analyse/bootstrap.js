import { registerServiceWorker } from '../../js/shared/pwa/sw-client.js';
registerServiceWorker();
import '../../js/components/index.js';
import { createAudioAnalyseFeature } from '../../js/tools/audioAnalyse/audioAnalyse.js';

const root = document.getElementById('view-audio-analyse');
if (!root) throw new Error('audio-analyse bootstrap: root element #view-audio-analyse fehlt');

const feature = createAudioAnalyseFeature();
feature.mount(root);
