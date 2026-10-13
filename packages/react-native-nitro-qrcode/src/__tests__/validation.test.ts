import { normalizeOptions } from "../validation";

describe("deprecated eyePatternShape alias", () => {
  it("maps onto eyeFrameShape and is not carried in normalized options", () => {
    const normalized = normalizeOptions({
      value: "alias",
      shapeOptions: { eyePatternShape: "circle" },
    });
    expect(normalized.shapeOptions.eyeFrameShape).toBe("circle");
    expect(Object.keys(normalized.shapeOptions)).not.toContain(
      "eyePatternShape",
    );
  });
});
