const LAUTSTAERKEN = ['laut', 'leise'];
const REPEATS = 2;

export function buildVariationList({ techniken = [], strumModi = [] } = {}) {
  const list = [];
  for (const technik of techniken) {
    for (const lautstaerke of LAUTSTAERKEN) {
      for (const strumModus of strumModi) {
        for (let repeatIndex = 1; repeatIndex <= REPEATS; repeatIndex++) {
          list.push({ technik, lautstaerke, strumModus, repeatIndex });
        }
      }
    }
  }
  return list;
}
