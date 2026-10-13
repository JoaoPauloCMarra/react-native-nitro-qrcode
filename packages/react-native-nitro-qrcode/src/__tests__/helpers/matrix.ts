export function allDarkModel(size = 21) {
  return { modules: { size, data: new Array(size * size).fill(true) } };
}
