import { describe, it, expect } from 'vitest';
import { buildVariationList } from '../../js/tools/chordRecorder/chordRecorderVariations.js';

describe('buildVariationList', () => {
  it('gibt leere Liste zurück wenn keine Techniken gewählt', () => {
    expect(buildVariationList({ techniken: [], strumModi: ['single'] })).toEqual([]);
  });

  it('gibt leere Liste zurück wenn keine Strum-Modi gewählt', () => {
    expect(buildVariationList({ techniken: ['finger'], strumModi: [] })).toEqual([]);
  });

  it('gibt leere Liste zurück bei leerem Config-Objekt', () => {
    expect(buildVariationList({})).toEqual([]);
    expect(buildVariationList()).toEqual([]);
  });

  it('gibt 4 Einträge für 1 Technik × 1 Modus (2 Lautstärken × 2 Wiederholungen)', () => {
    const result = buildVariationList({ techniken: ['finger'], strumModi: ['single'] });
    expect(result).toHaveLength(4);
  });

  it('gibt 8 Einträge für 2 Techniken × 1 Modus', () => {
    const result = buildVariationList({ techniken: ['finger', 'fingernagel'], strumModi: ['single'] });
    expect(result).toHaveLength(8);
  });

  it('gibt 36 Einträge für alle Optionen (3 × 2 × 3 × 2)', () => {
    const result = buildVariationList({
      techniken: ['finger', 'fingernagel', 'plektrum'],
      strumModi: ['single', 'multi1', 'multi2'],
    });
    expect(result).toHaveLength(36);
  });

  it('jeder Eintrag hat technik, lautstaerke, strumModus und repeatIndex', () => {
    const result = buildVariationList({ techniken: ['finger'], strumModi: ['single'] });
    expect(result[0]).toEqual({ technik: 'finger', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 1 });
    expect(result[1]).toEqual({ technik: 'finger', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 2 });
  });

  it('enthält sowohl laut als auch leise für jede Kombination', () => {
    const result = buildVariationList({ techniken: ['finger'], strumModi: ['single'] });
    const lautstaerken = [...new Set(result.map(v => v.lautstaerke))].sort();
    expect(lautstaerken).toEqual(['laut', 'leise']);
  });

  it('repeatIndex läuft von 1 bis 2', () => {
    const result = buildVariationList({ techniken: ['finger'], strumModi: ['single'] });
    const indices = [...new Set(result.map(v => v.repeatIndex))].sort();
    expect(indices).toEqual([1, 2]);
  });

  it('enthält alle gewählten Techniken', () => {
    const result = buildVariationList({ techniken: ['finger', 'plektrum'], strumModi: ['single'] });
    const techniken = [...new Set(result.map(v => v.technik))].sort();
    expect(techniken).toEqual(['finger', 'plektrum']);
  });

  it('enthält alle gewählten Strum-Modi', () => {
    const result = buildVariationList({ techniken: ['finger'], strumModi: ['single', 'multi1'] });
    const modi = [...new Set(result.map(v => v.strumModus))].sort();
    expect(modi).toEqual(['multi1', 'single']);
  });

  it('reihenfolge: Technik → Lautstärke → Modus → Wiederholung', () => {
    const result = buildVariationList({
      techniken: ['finger', 'plektrum'],
      strumModi: ['single', 'multi1'],
    });
    // Erste 4 Einträge: finger, laut, single (×2) + finger, laut, multi1 (×2)
    expect(result[0]).toMatchObject({ technik: 'finger', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 1 });
    expect(result[1]).toMatchObject({ technik: 'finger', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 2 });
    expect(result[2]).toMatchObject({ technik: 'finger', lautstaerke: 'laut', strumModus: 'multi1', repeatIndex: 1 });
    expect(result[3]).toMatchObject({ technik: 'finger', lautstaerke: 'laut', strumModus: 'multi1', repeatIndex: 2 });
  });
});
