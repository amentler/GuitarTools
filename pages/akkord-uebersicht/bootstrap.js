import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
registerServiceWorker();
import '../../js/components/index.js';
import { createAkkordUebersichtFeature } from '../../js/tools/akkordUebersicht/akkordUebersicht.js';

const root = document.getElementById('view-akkord-uebersicht');
if (!root) throw new Error('akkord-uebersicht bootstrap: root element #view-akkord-uebersicht fehlt');

const feature = createAkkordUebersichtFeature();
feature.mount(root);
