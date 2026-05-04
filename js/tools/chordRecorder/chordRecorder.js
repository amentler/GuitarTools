export function createChordRecorderTool() {
  async function mount(root) {
    root.innerHTML = `
      <div class="chord-recorder">
        <p class="chord-recorder__placeholder">Akkord-Recorder wird geladen …</p>
      </div>
    `;
  }

  return { mount };
}
