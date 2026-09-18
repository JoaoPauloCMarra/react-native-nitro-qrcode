import {
  isAlignmentModule,
  isFinderModule,
  isTimingModule,
} from "../qr-regions";

describe("qr region classification", () => {
  it("keeps version 1 matrices free of alignment modules", () => {
    expect(isAlignmentModule(18, 18, 21)).toBe(false);
    expect(isFinderModule(0, 0, 21)).toBe(true);
    expect(isTimingModule(6, 10, 21)).toBe(true);
  });

  it("classifies the version 2 alignment pattern and skips finder centers", () => {
    expect(isAlignmentModule(18, 18, 25)).toBe(true);
    expect(isAlignmentModule(6, 18, 25)).toBe(false);
    expect(isAlignmentModule(18, 6, 25)).toBe(false);
    expect(isAlignmentModule(0, 0, 25)).toBe(false);
  });

  it("rejects non-version matrix sizes", () => {
    expect(isAlignmentModule(10, 10, 22)).toBe(false);
  });
});
