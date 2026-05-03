# Plan: Reparatur der False Positives im Fingerprint

Stand: 2026-05-03

Status: teilweise abgeschlossen

Umgesetzt am 2026-05-03:
- `FN=0` bleibt im Essentia-Fingerprint erhalten.
- Der FP-Bestand wurde von `1279` auf `115` reduziert.
- Die Quality-Guards wurden auf den Essentia-Fingerprint und den aktuellen Fixture-Raum umgestellt.

Weiter offen:
- Weitere FP-Reduktion von `115` aus, ohne `FN=0` zu verletzen.
- Familienweise Nachschaerfung vor allem fuer `E-*`, `G7`, `sus`/`open-strum` und einzelne Alias-Paare.

**Plan**
Der Essentia-Fingerprint hat aktuell zwar `FN=0`, ist aber mit `FP=1279` fachlich nicht mehr belastbar. Ziel dieses Plans ist, die False Positives systematisch und messbar zu reduzieren, ohne den bereits erreichten Recall zu verlieren, und die Guard-/Regression-Landschaft wieder an einen realistischen Precision-Zustand anzubinden.

**Ziel und Ergebnis**
- Der Essentia-Fingerprint (`npm run fingerprint`) reduziert die aktuellen `FP=1279` deutlich und kontrolliert.
- `FN=0` ist harte, nicht verhandelbare Bedingung.
- Die Erkennung wird wieder ueber erklaerbare Regeln validiert statt ueber zu grosszuegige Sonderakzeptanz.
- Regressionen werden pro FP-Cluster abgesichert, damit spaetere Nachschaerfungen nicht dieselben Familien erneut aufreissen.

**Aktueller Ist-Zustand**
- Gemessen am 2026-05-03 mit `node scripts/chord-recognition-fingerprint.mjs`.
- Stand: `TP=79`, `FP=1279`, `FN=0`, `TN=5310`, `Precision=5.8%`, `Sensitivity=100.0%`, `F1=11.0%`.
- Die False Positives wirken nicht wie einzelne Ausreisser, sondern wie ein systemischer Over-Acceptance-Zustand.
- Viele FPs entstehen bei positiven Fixtures gegen falsche Probe-Akkorde, obwohl `bestMatch` oft beim eigentlichen Zielakkord bleibt. Das spricht fuer zu weiche Accept-/Tolerance-/Special-Case-Regeln.

**Fachliche Anforderungen**
- Ein positiver Fixture-Fall darf fuer seinen Zielakkord positiv bleiben.
- Kein derzeitiger True Positive darf durch die FP-Reparatur zu einem False Negative werden.
- Ein positiver Fixture-Fall darf nicht massenhaft fuer andere Akkorde derselben Root oder benachbarter Familien positiv werden.
- Explizite Negativfixtures muessen negativ bleiben, besonders Open-Strums und bekannte Gegenbeispiele wie `d_chord_wrong.wav`.
- Die Fingerprint-Auswertung bleibt ein Vollmatrix-Test mit `TP/FP/FN/TN` sowie Precision-, Recall- und F1-Metriken.
- `jsfingerprint` bleibt als Vergleichspfad separat ausfuehrbar und wird durch die FP-Reparatur nicht unbeabsichtigt entwertet.
- Quality-Guards muessen nach der Reparatur wieder eine realistische, verteidigbare Obergrenze abbilden statt einen offensichtlich obsoleten Grenzwert.

**Fachliche Testfaelle**
- Ein positiver Akkord wird nur fuer seinen Zielakkord als positiv gewertet, nicht pauschal fuer Varianten wie `7`, `maj7`, `m7`, `add9`, `sus2`, `sus4` oder `dim`.
- Dominant-/Major-/Minor-Varianten mit gleicher Root werden nur dann akzeptiert, wenn die dafuer notwendige Third-/Seventh-/Extension-Evidenz wirklich vorhanden ist.
- Sus- und Add9-Faelle bleiben fuer ihren Zielakkord erkennbar, kippen aber nicht mehr breit auf verwandte Familien.
- Diminished- und Seventh-Faelle bleiben fuer ihre echten Ziel-Faelle positiv, loesen aber keine grossflaechigen Mitakzeptanzen auf Triads oder Nachbarvarianten aus.
- Open-Strum-Negativfixtures bleiben negativ gegen alle Probe-Akkorde.
- Bekannte Problemfamilien werden nach der Reparatur explizit als Regressionen abgedeckt, nicht nur indirekt ueber Gesamtmetriken.

**Technisches Vorgehen**
- Primaer betroffen ist die Entscheidungslogik in [essentiaChordLogic.js](/home/azureuserhauptmann/privat/GuitarToolsALT/js/games/chordExerciseEssentia/essentiaChordLogic.js).
- Mess- und Reporting-Pfade liegen in [chord-recognition-fingerprint.mjs](/home/azureuserhauptmann/privat/GuitarToolsALT/scripts/chord-recognition-fingerprint.mjs), [essentiaFingerprintMetrics.js](/home/azureuserhauptmann/privat/GuitarToolsALT/tests/helpers/essentiaFingerprintMetrics.js), [essentiaChordFingerprintMetrics.test.js](/home/azureuserhauptmann/privat/GuitarToolsALT/tests/unit/essentiaChordFingerprintMetrics.test.js) und [essentiaChordFingerprintRegression.test.js](/home/azureuserhauptmann/privat/GuitarToolsALT/tests/unit/essentiaChordFingerprintRegression.test.js).
- Die vorhandenen Quality-Guards in [essentiaChordQualityGuards.test.js](/home/azureuserhauptmann/privat/GuitarToolsALT/tests/unit/essentiaChordQualityGuards.test.js) muessen als Teil der Reparatur ueberprueft und wahrscheinlich neu kalibriert werden.
- Vor jeder Regelveraenderung wird der aktuelle FP-Bestand in Cluster zerlegt, damit nicht blind an globalen Thresholds gedreht wird.

**Phasen**
- Phase 1: FP-Bestand reproduzierbar erfassen und clustern.
  Ziel: Die 1279 FPs in Familien zerlegen, z. B. same-root Varianten, sus/add9, seventh-family, dim-adjacent, offene Strums, bestMatch-target-but-wrong-probe.
  Validierung: Eine dokumentierte FP-Liste mit Haeufigkeit pro Cluster, Quellakkord und Probe-Akkord liegt vor.

- Phase 2: Over-Acceptance-Ursachen an der Matcher-Entscheidung isolieren.
  Ziel: Fuer die groessten Cluster nachvollziehen, ob sie aus `acceptsSpecialCase`, `bestMatchTolerance`, family-spezifischen Floors, Bass-Gates oder Profilschwellen entstehen.
  Validierung: Fuer jeden Top-Cluster ist mindestens ein konkreter technischer Ausloeser benannt.

- Phase 3: Breite Sonderakzeptanz zuerst einhegen.
  Ziel: Regeln abschwaechen oder auf engere Bedingungen begrenzen, die derzeit mit schwacher Evidenz Varianten derselben Root mitakzeptieren.
  Validierung: Deutlicher FP-Rueckgang bei strikt unveraendertem `FN=0` nach jeder Teilmassnahme.

- Phase 4: Familienweise Nachschaerfung statt globaler Threshold-Hammer.
  Ziel: Pro Akkordfamilie differenzieren, welche Evidenz wirklich erforderlich ist, insbesondere fuer `7`, `maj7`, `m7`, `sus2`, `sus4`, `add9`, `dim`.
  Validierung: Betroffene Cluster schrumpfen, ohne stabile Referenz-TPs derselben Familie zu verlieren.

- Phase 5: Regressionen und Guards auf die reparierte Logik ausrichten.
  Ziel: Die wichtigsten zuvor offenen FP-Faelle als gezielte Tests absichern und den Precision-Guard auf einen wieder realistischen Korridor setzen.
  Validierung: Fingerprint, Regressionstests und aktualisierte Guards laufen gemeinsam gruen.

- Phase 6: Abschlussmessung und Restbudget.
  Ziel: Endstand mit `TP/FP/FN/TN`, Precision und verbleibenden Restclustern dokumentieren; offene Rest-FPs bewusst benennen statt verstecken.
  Validierung: Ein nachvollziehbarer Nachher-Stand liegt vor und ist fachlich begruendbar.

**Priorisierte Arbeitshypothesen**
- Die aktuelle Essentia-Strategie akzeptiert zu viele Varianten derselben Root, obwohl `bestMatch` bereits den echten Zielakkord zeigt.
- Family-spezifische Confidence-Floors fuer `ESSENTIA_FINGERPRINT` sind an mehreren Stellen zu niedrig fuer Variantenentscheidungen.
- `acceptsSpecialCase` und/oder Toleranzpfade sind seit der FN-Null-Optimierung zu breit geworden und dominieren die Precision.
- Bass-Evidenz verhindert einzelne Fehlzuordnungen, ist aber aktuell nicht stark genug, um breite Mitakzeptanz verwandter Akkorde zu stoppen.
- Die historischen Precision-Guards stammen aus einem deutlich kleineren FP-Raum und muessen nach der Reparatur neu an den heutigen Fixture-Bestand gekoppelt werden.

**Risiken / Offene Fragen**
- Das groesste Risiko ist ein Rueckfall von `FN=0`, wenn Sonderakzeptanz zu hart zurueckgebaut wird.
- Jede Regelveraenderung muss deshalb sofort gegen den kompletten Fingerprint validiert werden; Aenderungen mit neuem FN sind nicht akzeptabel.
- Ein globales Threshold-Tuning ohne Clusteranalyse wuerde wahrscheinlich sowohl echte TPs als auch FPs gleichzeitig verschieben und ist deshalb zu spaet anzusetzen.
- Ein Teil der Konfusionen kann strukturell aus pitch-class-aehnlichen Akkorden stammen; solche Restfaelle muessen explizit als Restbudget behandelt werden.
- Falls `bestMatch !== probeChordName`, aber `isCorrect === true`, sollte fachlich geprueft werden, ob dieser Akzeptanzpfad fuer den Fingerprint ueberhaupt weiterhin gewollt ist oder nur fuer die Live-UI toleriert werden darf.

**Rueckfragen zur Implementierung**
- `Blockierend`: Soll der Fingerprint fachlich strenger sein als die Live-UI, falls dafuer ein separater Strategy-/Acceptance-Pfad noetig ist? Default: ja, der Fingerprint darf strenger sein.
- `Wichtig`: Ein hoeherer Rest-FP-Bestand ist akzeptabler als auch nur ein neuer FN. Default: ja.
- `Wichtig`: Sollen bestehende veraltete Quality-Guards im selben Arbeitspaket aktualisiert werden oder erst nach der eigentlichen Matcher-Reparatur? Default: erst nach der Matcher-Reparatur, damit Guards das neue Verhalten abbilden.
- `Optional`: Soll der Abschluss ein explizites FP-Restbudget pro Akkordfamilie definieren? Default: ja, weil das spaetere Regressionen besser steuerbar macht.

Ich starte mit der Umsetzung erst, wenn du den Plan freigibst.
