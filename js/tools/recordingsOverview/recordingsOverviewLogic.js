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
