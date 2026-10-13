export function createMockHybridObject(png: ArrayBuffer) {
  return {
    generatePngArrayBufferObject: jest.fn(() => png),
    generatePngArrayBufferAsyncObject: jest.fn(async () => png),
    generatePngBase64Object: jest.fn(() => "png-base64"),
    generatePngBase64AsyncObject: jest.fn(async () => "png-base64"),
    generatePngDataUriObject: jest.fn(() => "data:image/png;base64,png-base64"),
    generatePngDataUriAsyncObject: jest.fn(
      async () => "data:image/png;base64,png-base64",
    ),
    generateSvgStringObject: jest.fn(() => "<svg />"),
    getMatrixObject: jest.fn(() => ({
      size: 21,
      packedBase64: "matrix-base64",
    })),
    getMatrixPackedBase64: jest.fn(() => "matrix-base64"),
    getMatrixSize: jest.fn(() => 21),
    clearCache: jest.fn(),
    getCacheSize: jest.fn(() => 2),
    getCacheBytes: jest.fn(() => 256),
  };
}
