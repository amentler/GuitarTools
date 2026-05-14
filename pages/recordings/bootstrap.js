import { registerServiceWorker } from '../../js/shared/pwa/sw-client.js';
registerServiceWorker();
import '../../js/components/index.js';
import { createRecordingsOverviewFeature } from '../../js/tools/recordingsOverview/recordingsOverview.js';

const root = document.getElementById('view-recordings');
if (!root) throw new Error('recordings bootstrap: root element #view-recordings fehlt');

const feature = createRecordingsOverviewFeature();
feature.mount(root);
