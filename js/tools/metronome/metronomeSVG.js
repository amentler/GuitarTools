/**
 * Visual feedback for the metronome.
 * Displays a row of dots representing beats, highlighting the current beat.
 */

export class MetronomeSVG {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.dots = [];
  }

  render(beatsPerMeasure) {
    this.container.innerHTML = ''; // Clear container

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 400 100");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    this.dots = [];
    const spacing = 400 / (beatsPerMeasure + 1);

    for (let i = 0; i < beatsPerMeasure; i++) {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", spacing * (i + 1));
      circle.setAttribute("cy", 50);
      circle.setAttribute("r", 15);
      circle.setAttribute("fill", "#333"); // Default inactive color
      circle.setAttribute("stroke", i === 0 ? "#ff4d4d" : "#4d94ff"); // Accent color for beat 1
      circle.setAttribute("stroke-width", "2");
      
      svg.appendChild(circle);
      this.dots.push(circle);
    }

    this.container.appendChild(svg);
  }

  highlightBeat(beatNumber) {
    this.dots.forEach((dot, index) => {
      if (index === beatNumber) {
        // Highlighting active beat
        dot.setAttribute("fill", index === 0 ? "#ff4d4d" : "#4d94ff");
        dot.setAttribute("r", "20");
        dot.style.transition = "r 0.1s ease-out, fill 0.1s ease-out";
      } else {
        // Resetting others
        dot.setAttribute("fill", "#333");
        dot.setAttribute("r", "15");
      }
    });
    
    // Quick reset for the "pop" effect
    setTimeout(() => {
        if (this.dots[beatNumber]) {
            this.dots[beatNumber].setAttribute("r", "15");
        }
    }, 100);
  }
}
