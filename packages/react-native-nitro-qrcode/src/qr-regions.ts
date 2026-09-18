export function isFinderModule(x: number, y: number, matrixSize: number): boolean {
  const top = y >= 0 && y < 7;
  const left = x >= 0 && x < 7;
  const right = x >= matrixSize - 7 && x < matrixSize;
  const bottom = y >= matrixSize - 7 && y < matrixSize;
  return (top && left) || (top && right) || (bottom && left);
}

export function isAlignmentModule(
  x: number,
  y: number,
  matrixSize: number,
): boolean {
  if (isFinderModule(x, y, matrixSize)) {
    return false;
  }
  const version = (matrixSize - 17) / 4;
  if (version < 2 || !Number.isInteger(version)) {
    return false;
  }
  const positions = alignmentPatternPositions(version, matrixSize);
  for (const centerY of positions) {
    for (const centerX of positions) {
      if (isFinderAlignmentCenter(centerX, centerY, matrixSize)) {
        continue;
      }
      if (Math.abs(x - centerX) <= 2 && Math.abs(y - centerY) <= 2) {
        return true;
      }
    }
  }
  return false;
}

export function isTimingModule(
  x: number,
  y: number,
  matrixSize: number,
): boolean {
  if (x !== 6 && y !== 6) {
    return false;
  }
  return (
    !isFinderModule(x, y, matrixSize) &&
    !isAlignmentModule(x, y, matrixSize)
  );
}

function isFinderAlignmentCenter(
  x: number,
  y: number,
  matrixSize: number,
): boolean {
  return (
    (x === 6 && y === 6) ||
    (x === 6 && y === matrixSize - 7) ||
    (x === matrixSize - 7 && y === 6)
  );
}

function alignmentPatternPositions(version: number, matrixSize: number): number[] {
  if (version < 2) {
    return [];
  }
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const positions: number[] = [];
  for (let index = 0, pos = matrixSize - 7; index < numAlign - 1; index += 1, pos -= step) {
    positions.unshift(pos);
  }
  positions.unshift(6);
  return positions;
}
