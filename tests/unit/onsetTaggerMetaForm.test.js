// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  renderMetaForm,
  readMetaForm,
  DEFAULT_SIDECAR_FIELDS,
  DROPDOWN_OPTIONS,
} from '../../js/tools/onsetTagger/onsetTaggerMetaForm.js';

describe('DEFAULT_SIDECAR_FIELDS', () => {
  it('has expected top-level keys', () => {
    expect(DEFAULT_SIDECAR_FIELDS).toHaveProperty('category');
    expect(DEFAULT_SIDECAR_FIELDS).toHaveProperty('chord');
    expect(DEFAULT_SIDECAR_FIELDS).toHaveProperty('bpm');
    expect(DEFAULT_SIDECAR_FIELDS).toHaveProperty('browserEnvironment');
  });
  it('browserEnvironment is a nested object', () => {
    expect(typeof DEFAULT_SIDECAR_FIELDS.browserEnvironment).toBe('object');
    expect(DEFAULT_SIDECAR_FIELDS.browserEnvironment).toHaveProperty('browser');
  });
});

describe('DROPDOWN_OPTIONS', () => {
  it('has expected keys', () => {
    expect(DROPDOWN_OPTIONS).toHaveProperty('category');
    expect(DROPDOWN_OPTIONS).toHaveProperty('chord');
    expect(DROPDOWN_OPTIONS).toHaveProperty('timeSig');
  });
  it('each option list starts with empty string', () => {
    for (const opts of Object.values(DROPDOWN_OPTIONS)) {
      expect(opts[0]).toBe('');
    }
  });
});

describe('readMetaForm – null form', () => {
  it('returns empty object when metaForm is null', () => {
    expect(readMetaForm({ metaForm: null })).toEqual({});
  });
});

describe('renderMetaForm + readMetaForm round-trip', () => {
  it('renders text field and reads value back', () => {
    const container = document.createElement('div');
    const ui = { metaForm: container };
    renderMetaForm(ui, { description: 'hello world' });
    const result = readMetaForm(ui);
    expect(result.description).toBe('hello world');
  });

  it('renders select field and reads selected value', () => {
    const container = document.createElement('div');
    const ui = { metaForm: container };
    renderMetaForm(ui, { category: 'sheet-music-reading' });
    const result = readMetaForm(ui);
    expect(result.category).toBe('sheet-music-reading');
  });

  it('skips onsetsMs field', () => {
    const container = document.createElement('div');
    const ui = { metaForm: container };
    renderMetaForm(ui, { description: 'test', onsetsMs: [100, 200] });
    const result = readMetaForm(ui);
    expect(result).not.toHaveProperty('onsetsMs');
    expect(result.description).toBe('test');
  });
});
