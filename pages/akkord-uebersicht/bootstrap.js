import '../../js/components/index.js';
import { createAkkordUebersichtTool } from '../../js/tools/akkordUebersicht/akkordUebersicht.js';

const root = document.getElementById('view-akkord-uebersicht');
if (!root) throw new Error('akkord-uebersicht bootstrap: root element #view-akkord-uebersicht fehlt');

const tool = createAkkordUebersichtTool();
tool.mount(root);
