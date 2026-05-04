import { registerServiceWorker } from "../../js/shared/pwa/sw-client.js";
import '../../js/components/index.js';

registerServiceWorker();

const targetUrl = new URL('../sheet-music-reading/index.html?active=1', globalThis.location?.href ?? window.location.href);
window.location.replace(targetUrl.toString());
