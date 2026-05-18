import { test, expect } from '@playwright/test';

test.describe('Aufnahmen – Übersicht', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/recordings/index.html');
  });

  test('Seite lädt und zeigt leere-Meldung', async ({ page }) => {
    await expect(page.locator('#recordings-empty')).toBeVisible();
    await expect(page.locator('#recordings-selection-actions')).toBeHidden();
    await expect(page.locator('#recordings-bulk-actions')).toBeHidden();
  });

  test('Bulk-Aktionen erscheinen nach IndexedDB-Seeding', async ({ page }) => {
    // Seed a fake chord-recorder entry directly into IndexedDB
    await page.evaluate(async () => {
      const wavBytes = new Uint8Array(44).fill(0); // minimal placeholder
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('chord-recorder', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('recordings', { keyPath: 'baseName' });
        req.onsuccess = async e => {
          const db = e.target.result;
          const tx = db.transaction('recordings', 'readwrite');
          tx.objectStore('recordings').put({
            baseName: 'test_fingerpick_low_down_aaaaa',
            wavBlob: blob,
            sidecar: {
              chord: 'Am',
              technique: 'fingerpick',
              recordedAt: new Date().toISOString(),
            },
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();

    // Bulk actions should now be visible
    await expect(page.locator('#recordings-bulk-actions')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#recordings-empty')).toBeHidden();
    await expect(page.locator('#recordings-list li')).toHaveCount(1);
  });

  test('Checkbox-Auswahl macht Auswahl-Aktionsbereich sichtbar', async ({ page }) => {
    // Seed
    await page.evaluate(async () => {
      const blob = new Blob([new Uint8Array(44)], { type: 'audio/wav' });
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('chord-recorder', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('recordings', { keyPath: 'baseName' });
        req.onsuccess = e => {
          const db = e.target.result;
          const tx = db.transaction('recordings', 'readwrite');
          tx.objectStore('recordings').put({
            baseName: 'sel_test_aaaaa',
            wavBlob: blob,
            sidecar: { chord: 'G', technique: 'strum', recordedAt: new Date().toISOString() },
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();

    await expect(page.locator('#recordings-selection-actions')).toBeHidden();
    const checkbox = page.locator('.recordings-item__check').first();
    await checkbox.check();
    await expect(page.locator('#recordings-selection-actions')).toBeVisible();

    // Analyse + Tagger buttons are enabled for exactly 1 selection
    await expect(page.locator('#btn-open-analyse')).toBeEnabled();
    await expect(page.locator('#btn-open-tagger')).toBeEnabled();
  });

});
