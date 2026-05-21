# Ideen & Feature-Wishlist

Dieses Dokument sammelt Ideen für zukünftige Features, Verbesserungen und Experimente.
Neue Ideen können ohne Implementierungsplan hier festgehalten werden.

---

## Spielerfahrung / Übungen

- **Rhythmus-Erkennung**: Erkennt ob Gitarrist im Takt spielt (Onset-Zeitstempel vs. Metronom)
- **Bending-Detektion**: Pitch-Glissando nach dem Anschlag erkennen und bewerten
- **Akkord-Übergänge**: Timer misst Wechselzeit zwischen zwei Akkorden → Üben auf Geschwindigkeit
- **Skalen-Trainer**: Ähnlich TonFinder aber für Skalen; zeigt Muster auf dem Griffbrett
- **Finger-Picking-Muster**: Picking-Pattern als Übungseinheit, nicht nur Strum

## Audio & Erkennung

- **Capo-Support**: Fret-Offset für Capo-Spieler in allen Übungen
- **Multi-String-Erkennung**: Gleichzeitige Noten auf mehreren Saiten erkennen (Polyphonie)
- **Stimmungs-Kalibration**: Eigene Referenzfrequenz (Kammerton) konfigurierbar (z.B. 432 Hz)
- **Mikrofon-Qualitäts-Check**: Warnung bei schlechtem SNR vor Übungsstart

## UI / UX

- **Dark-/Light-Mode-Toggle**: Nutzer kann Theme wechseln (aktuell nur Dark)
- **Fortschrittsbalken über alle Tage**: SRS-Kalender-View (Heatmap)
- **Offline-Badge**: Deutlicher Hinweis wenn App offline läuft (PWA-State sichtbar)
- **Keyboard-Shortcuts-Overlay**: Alle Shortcuts auf einem Screen (`?` Taste)

## Tools

- **Metronom-Tap-Tempo**: BPM durch Tippen ermitteln
- **Akkord-Übersicht druckbar**: PDF/Print-optimiertes Layout der Akkord-Übersicht
- **Recording-Sharing**: Einzelne Aufnahmen als WAV direkt teilen (Web Share API)

## Technisches / Infrastruktur

- **Code-Splitting via Rolldown**: Optional, für bessere Ladezeiten auf langsameren Verbindungen
- **Lighthouse CI**: Automatischer Lighthouse-Score in CI/CD
- **i18n-Vorbereitung**: Strings in en/de trennbar machen (falls mehrsprachig gewünscht)

---

*Ergänze Ideen einfach mit einem neuen Bullet-Point.*
