import { describe, expect, it } from "vitest";
import { normalizeBlockTag } from "../shared.js";

describe("normalizeBlockTag", () => {
  it("preserves common symbolic tags", () => {
    expect(normalizeBlockTag("latest")).toBe("latest");
    expect(normalizeBlockTag("pending")).toBe("pending");
    expect(normalizeBlockTag("earliest")).toBe("earliest");
  });

  it("converts decimal values to hex", () => {
    expect(normalizeBlockTag("16")).toBe("0x10");
  });
});
