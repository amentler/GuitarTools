# Archiv: Open-Strum-Reject-Plan - Phasen 1-4

Quelle: `plans/open-strum-reject-plan-2026-05-02.md`
Archiviert: 2026-05-02
Grund: Die Phasen 1 bis 4 des Open-Strum-Reject-Plans wurden umgesetzt und verifiziert. Im aktiven Plan bleiben nur Risiken, Varianten und moegliche Folgearbeit.

## Phase 1: Analyse- und Modellierungsphase

Status: abgeschlossen am 2026-05-02

Ziel:
- Festlegen, wie `open-strum` fachlich in den Matcher integriert wird.

Arbeit:
- Vergleich der bestehenden Open-Strum-FPs nach Score-Mustern.
- Pruefen, ob ein generischer `open-strum`-Kandidat ausreicht oder ob mehrere Untertypen sofort noetig waeren.
- Entscheidung, welche Signale die Reject-Entscheidung tragen sollen.

Validierung:
- Klare Definition, wann `open-strum` als dominanter Kandidat gilt.

Ergebnis:
- Phase 1 wurde mit einem generischen `open-strum`-Kandidaten und vorsichtigem Margen-Gate umgesetzt.

## Phase 2: Matcher-Kandidat `open-strum`

Status: abgeschlossen am 2026-05-02

Ziel:
- `open-strum` als expliziten Sonderkandidaten im Candidate-Scoring ergaenzen.

Arbeit:
- Sonderkandidat in der Match-Logik aufnehmen.
- Score-Regel und Vergleich mit normalen Akkordkandidaten implementierbar vorbereiten.

Validierung:
- Unit-Tests zeigen, dass `bestMatch` in Open-Strum-Faellen auch `open-strum` werden kann.

Ergebnis:
- `open-strum` wurde als interner Matcher-Kandidat in `js/games/chordExerciseEssentia/essentiaChordLogic.js` ergaenzt.

## Phase 3: Reject-Gate integrieren

Status: abgeschlossen am 2026-05-02

Ziel:
- Akkord-Claims blockieren, wenn `open-strum` dominant oder zu nah am besten Akkordkandidaten ist.

Arbeit:
- Reject-Regel in den Acceptance-Pfad einbauen.
- Sicherheitsmarge gegen False Negatives auf echten Akkorden definieren.

Validierung:
- Gezielte Regressionen auf heutige Open-Strum-FPs.

Ergebnis:
- Akkord-Claims werden bei starkem `open-strum`-Kandidaten verworfen; eine Schutzregel fuer echte Septakkorde wurde ergaenzt.

## Phase 4: Fingerprint-Messung und Nachschaerfung

Status: abgeschlossen am 2026-05-02

Ziel:
- Wirkung auf Precision und Recall reproduzierbar messen.

Arbeit:
- Fingerprint ausfuehren.
- FP-Rueckgang bei Open-Strums gegen moegliche neue FNs abwaegen.
- Falls noetig Schwellenwerte feinjustieren.

Validierung:
- Fingerprint-Vergleich vor/nachher.
- Relevante Fixture-Tests gruen.

Ergebnis:
- Fingerprint ausgefuehrt: `TP=57`, `FP=14`, `FN=0`, `TN=5160`, `F1=89.1%`.
- Die `open-strums/*`-False-Positives sind nicht mehr in der FP-Liste.
