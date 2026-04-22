import '../../js/components/index.js';
import { createTonFinderFeature } from '../../js/games/tonFinder/tonFinder.js';

const root = document.getElementById('view-ton-finder');
if (!root) throw new Error('ton-finder bootstrap: root element #view-ton-finder fehlt');

const feature = createTonFinderFeature();
feature.mount(root);
