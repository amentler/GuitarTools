export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(isoString) {
  if (!isoString) return '–';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '–';
  return d.toLocaleString('de-DE');
}

export function buildDisplayName(source, id, metadata) {
  const baseName = metadata?.baseName ?? metadata?.fileName ?? metadata?.filename;
  if (baseName) return baseName;
  if (source === 'sheet-music') {
    const date = metadata?.savedAt ? ` · ${formatDate(metadata.savedAt)}` : '';
    return `Notenlesen-Aufnahme${date}`;
  }
  if (source === 'chord-recorder') {
    if (!metadata) return id;
    const parts = [metadata.chord, metadata.technique].filter(Boolean);
    const date = metadata.recordedAt ? ` · ${formatDate(metadata.recordedAt)}` : '';
    return parts.length ? `${parts.join(' · ')}${date}` : id;
  }
  return id;
}

export function buildAudioAnalyseUrl(source, id) {
  return `../audio-analyse/index.html?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`;
}

export function buildOnsetTaggerUrl(source, id) {
  return `../onset-tagger/index.html?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`;
}

export function buildTrainingDataOnsetTaggerUrl(id) {
  return buildOnsetTaggerUrl('training-data', id);
}

export function sortByDate(recordings) {
  return [...recordings].sort((a, b) => b.date - a.date);
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function getTrainingReviewIssueCount(entry) {
  const metrics = entry?.metrics ?? {};
  return numberOrZero(metrics.fp) + numberOrZero(metrics.fn);
}

export function compareTrainingReviewEntries(a, b, sortKey = 'issues', direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1;
  const metricValue = (entry, key) => {
    if (key === 'issues') return getTrainingReviewIssueCount(entry);
    if (key === 'name') return String(entry?.name ?? '').toLocaleLowerCase('de-DE');
    if (key === 'kind') return String(entry?.kind ?? '');
    if (key === 'match') return String(entry?.match?.status ?? '');
    return numberOrZero(entry?.metrics?.[key]);
  };

  const av = metricValue(a, sortKey);
  const bv = metricValue(b, sortKey);
  if (typeof av === 'string' || typeof bv === 'string') {
    const compared = String(av).localeCompare(String(bv), 'de-DE');
    if (compared !== 0) return compared * factor;
  } else if (av !== bv) {
    return (av - bv) * factor;
  }

  const ai = getTrainingReviewIssueCount(a);
  const bi = getTrainingReviewIssueCount(b);
  if (ai !== bi) return bi - ai;
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'de-DE');
}

export function sortTrainingReviewEntries(entries, sortKey = 'issues', direction = 'desc') {
  return [...entries].sort((a, b) => compareTrainingReviewEntries(a, b, sortKey, direction));
}

/**
 * Builds a safe filesystem name (without extension) for a ZIP entry.
 * @param {string} source  'sheet-music' | 'chord-recorder'
 * @param {string} id
 * @param {object|null} metadata
 * @returns {string}
 */
export function buildZipEntryName(source, id, metadata) {
  if (source === 'sheet-music') {
    const date = metadata?.savedAt
      ? new Date(metadata.savedAt).toISOString().slice(0, 10)
      : null;
    return date ? `notenlesen_${date}` : `notenlesen_${id}`;
  }
  if (source === 'chord-recorder') {
    const parts = [metadata?.chord, metadata?.technique].filter(Boolean);
    return parts.length ? parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '') : id;
  }
  return id;
}
