# Plan: 🎵 Intervall-Gehörtraining

**Status:** Geplant ⏳  
**Typ:** Übung  
**Zielgruppe:** Einsteiger bis Fortgeschrittene

---

## AI Collaboration & Mandate

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this plan, and any other relevant documentation).
- **Keep Plans Current:** If this plan is part of an ongoing task, update the status and next steps after each work session.
- **Consistency:** Maintain the project's "Vanilla JS" and SVG-focused architecture.

---

## Ziel

Zwei Töne werden nacheinander vorgespielt oder angezeigt. Der Nutzer identifiziert das klangliche Intervall zwischen ihnen.

---

## Funktionsumfang

### Kern-Feature
- Zwei Töne werden per Web Audio API nacheinander abgespielt
- Gleichzeitig werden beide Tonnamen eingeblendet (z. B. „C → E")
- Nutzer wählt aus einer Auswahl-Liste das Intervall (Sekunde, Terz, Quarte, Quinte, Sexte, Septime, Oktave)
- Sofortiges Feedback: richtig (grün) oder falsch (rot + korrektes Intervall)

### Schwierigkeitsstufen
- **Stufe 1 – Visuell:** Beide Tonnamen sichtbar, nur Intervall benennen
- **Stufe 2 – Auditiv:** Nur Töne hören, keiner der Namen sichtbar
- **Stufe 3 – Gemischt:** Erster Ton sichtbar, zweiter nur hören

### Spielmodus
- 10 Fragen pro Runde, danach Auswertung (Score, Fehlerübersicht)
- Wiederholungs-Button spielt die Töne erneut ab

---

## Technische Umsetzung

### Neue Dateien
```
js/games/intervallTrainer/
├── intervallTrainer.js   – Spielzustand, Fragerunden
├── intervallLogic.js     – Intervall-Berechnung, Ton-Paare generieren
├── intervallAudio.js     – Web Audio API Sinuston-Synthese
└── CLAUDE.md
```

### Wiederverwendung
- `fretboardLogic.js` – Tonname-Berechnungen (`NOTE_NAMES`, Frequenz-Mapping)
- CSS-Klassen `.correct` / `.wrong` aus dem bestehenden Übungssystem

### Intervall-Berechnung
```js
// intervallLogic.js
const INTERVALS = [
  { name: "Sekunde",  semitones: 2 },
  { name: "Terz",     semitones: 4 },
  { name: "Quarte",   semitones: 5 },
  // ...
];
function getInterval(noteA, noteB) { /* semitone diff → Intervallname */ }
```

### Ton-Synthese
- Sinuswellen über `OscillatorNode` (Web Audio API)
- Frequenzen aus Standard-Stimmung (A4 = 440 Hz)
- Dauer: 0,8 s pro Ton, 0,2 s Pause dazwischen

### index.html
- Neuer View `#view-intervall-trainer` mit Ton-Anzeige, Intervall-Buttons, Score
- Menü-Eintrag „Intervall-Trainer"

### app.js
- Navigation und `startExercise()` / `stopExercise()` einbinden

---

## Offene Fragen / Erweiterungen

- Melodische vs. harmonische Intervalle (gleichzeitig oder nacheinander)
- Unterstützung von Dreiklängen (Akkord-Gehörtraining)
- Fortschrittsbalken und Highscore-Speicherung via `localStorage`
