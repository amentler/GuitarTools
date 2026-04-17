/**
 * TDD-Tests für die Metronom-Akkord-Synchronisation im akkordfolgenTrainer.
 *
 * Das Problem: Der Akkordwechsel wird aktuell per setTimeout(chordDurationMs)
 * gesteuert – unabhängig vom Metronom. Dadurch driften Zählzeit-1 (Beat 0)
 * und Akkordwechsel auseinander.
 *
 * Korrektes Verhalten: Der Akkordwechsel soll exakt auf Beat 0 (der "1" des
 * Metronoms) stattfinden – gesteuert durch den onBeat-Callback, nicht durch
 * einen eigenen Timer.
 *
 * Diese Tests sind zunächst ROT, weil createBeatChordSync noch nicht
 * in akkordfolgenLogic.js existiert.
 */

import { describe, it, expect } from 'vitest';
import { createBeatChordSync } from '../../js/games/akkordfolgenTrainer/akkordfolgenLogic.js';

describe('createBeatChordSync – Grundverhalten', () => {
  it('gibt false zurück wenn Beat 0 zum ersten Mal feuert (Akkord 0 startet)', () => {
    const sync = createBeatChordSync();
    expect(sync.onBeat(0)).toBe(false);
  });

  it('gibt false für Beats 1, 2, 3 zurück (kein Akkordwechsel mitten im Takt)', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0); // Starttakt
    expect(sync.onBeat(1)).toBe(false);
    expect(sync.onBeat(2)).toBe(false);
    expect(sync.onBeat(3)).toBe(false);
  });

  it('gibt true zurück wenn Beat 0 zum zweiten Mal feuert (Akkordwechsel auf der 1)', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0); // Takt 1 – Akkord 0
    sync.onBeat(1);
    sync.onBeat(2);
    sync.onBeat(3);
    expect(sync.onBeat(0)).toBe(true); // Takt 2 – Akkord 1 → true
  });

  it('gibt beim dritten Beat-0-Aufruf erneut true zurück', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0); // Takt 1
    sync.onBeat(1); sync.onBeat(2); sync.onBeat(3);
    sync.onBeat(0); // Takt 2 – advance
    sync.onBeat(1); sync.onBeat(2); sync.onBeat(3);
    expect(sync.onBeat(0)).toBe(true); // Takt 3 – advance
  });

  it('gibt false für Beats nach dem Akkordwechsel (kein Doppel-Advance)', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0);
    sync.onBeat(1); sync.onBeat(2); sync.onBeat(3);
    sync.onBeat(0); // advance
    expect(sync.onBeat(1)).toBe(false); // keine weiteren advances im gleichen Takt
    expect(sync.onBeat(2)).toBe(false);
    expect(sync.onBeat(3)).toBe(false);
  });
});

describe('createBeatChordSync – verschiedene Taktarten', () => {
  it('funktioniert mit 2 Schlägen pro Akkord', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0); // Start
    sync.onBeat(1);
    expect(sync.onBeat(0)).toBe(true); // nach 2 Schlägen advance
  });

  it('funktioniert mit 3 Schlägen pro Akkord (Walzer)', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0); // Start
    sync.onBeat(1);
    sync.onBeat(2);
    expect(sync.onBeat(0)).toBe(true); // nach 3 Schlägen advance
  });
});

describe('createBeatChordSync – Nachweis des Sync-Problems', () => {
  /**
   * Diese Tests dokumentieren den Kern des Fehlers:
   * Der Akkordwechsel darf NUR auf Beat 0 passieren, nie auf anderen Beats.
   * Im aktuellen Code passiert der Wechsel nach einem setTimeout, der
   * unabhängig läuft und jeden Beat treffen kann.
   */

  it('löst auf Beat 1 KEINEN Akkordwechsel aus, auch wenn die Zeit abgelaufen wäre', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0);
    // Selbst wenn setTimeout abgelaufen ist, darf der Wechsel nur auf Beat 0 passieren
    expect(sync.onBeat(1)).toBe(false);
  });

  it('löst auf Beat 2 KEINEN Akkordwechsel aus', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0);
    sync.onBeat(1);
    expect(sync.onBeat(2)).toBe(false);
  });

  it('löst auf Beat 3 KEINEN Akkordwechsel aus', () => {
    const sync = createBeatChordSync();
    sync.onBeat(0);
    sync.onBeat(1);
    sync.onBeat(2);
    expect(sync.onBeat(3)).toBe(false);
  });

  it('advance passiert stets auf Beat 0, nicht nach Ablauf eines unabhängigen Timers', () => {
    // Simuliert mehrere vollständige Takte; jeder Advance muss auf Beat 0 fallen
    const sync = createBeatChordSync();
    const advanceBeats = [];

    const beats = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
    beats.forEach(b => {
      if (sync.onBeat(b)) advanceBeats.push(b);
    });

    // Jeder Advance muss auf Beat 0 passieren
    expect(advanceBeats.every(b => b === 0)).toBe(true);
    // Es muss genau 2 Advances gegeben haben (Takt 2 und 3)
    expect(advanceBeats.length).toBe(2);
  });
});
