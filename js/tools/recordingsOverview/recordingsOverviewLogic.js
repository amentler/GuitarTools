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

export function sortByDate(recordings) {
  return [...recordings].sort((a, b) => b.date - a.date);
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
