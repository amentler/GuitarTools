import '../../js/components/index.js';
import { createMetronomeTool } from '../../js/tools/metronome/metronome.js';

const root = document.getElementById('view-metronome');
if (!root) throw new Error('metronome bootstrap: root element #view-metronome fehlt');

const tool = createMetronomeTool();
tool.mount(root);
