export const TRAINING_REVIEW_CATALOG_URL = '../../js/data/android-firefox-training-review-catalog.json';

let catalogPromise = null;

function cloneEntry(entry) {
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

export function normalizeTrainingDataSidecar(data) {
  if (!data || typeof data !== 'object') return null;
  const onsetsMs = Array.isArray(data.onsetsMs)
    ? data.onsetsMs
    : data.annotations?.onsetsMs;
  return {
    ...(data.metadata ?? {}),
    ...data,
    onsetsMs: Array.isArray(onsetsMs) ? onsetsMs.slice() : [],
  };
}

export async function loadTrainingReviewCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(TRAINING_REVIEW_CATALOG_URL)
      .then(response => {
        if (!response.ok) throw new Error(`catalog ${response.status}`);
        return response.json();
      })
      .then(catalog => ({
        ...catalog,
        entries: Array.isArray(catalog.entries) ? catalog.entries : [],
      }));
  }
  return catalogPromise;
}

export async function getTrainingReviewEntries() {
  const catalog = await loadTrainingReviewCatalog();
  return catalog.entries.map(cloneEntry).filter(Boolean);
}

export async function getTrainingReviewEntry(id) {
  const catalog = await loadTrainingReviewCatalog();
  return cloneEntry(catalog.entries.find(entry => entry.id === id));
}
