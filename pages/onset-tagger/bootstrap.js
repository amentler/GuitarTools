import { registerServiceWorker } from '../../js/shared/pwa/sw-client.js';
registerServiceWorker();
import '../../js/components/index.js';
import { createOnsetTaggerFeature } from '../../js/tools/onsetTagger/onsetTagger.js';

const root = document.getElementById('view-onset-tagger');
if (!root) throw new Error('onset-tagger bootstrap: root element #view-onset-tagger fehlt');

const feature = createOnsetTaggerFeature();
feature.mount(root);
