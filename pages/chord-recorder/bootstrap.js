import { registerServiceWorker } from '../../js/shared/pwa/sw-client.js';
registerServiceWorker();
import '../../js/components/index.js';
import { createChordRecorderTool } from '../../js/tools/chordRecorder/chordRecorder.js';

const root = document.getElementById('chord-recorder-root');
if (!root) throw new Error('chord-recorder bootstrap: root element #chord-recorder-root fehlt');

const tool = createChordRecorderTool();
await tool.mount(root);
