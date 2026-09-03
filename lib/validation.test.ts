import { describe, expect, it } from "vitest";
import { isValidUuid } from "@/lib/validation";

describe("isValidUuid", () => {
  it("accepts a well-formed v4 uuid", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts uppercase uuids", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidUuid("")).toBe(false);
  });

  it("rejects a non-uuid string", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });

  it("rejects an oversized/malformed payload instead of throwing", () => {
    expect(isValidUuid("a".repeat(10_000))).toBe(false);
  });

  it("rejects a uuid missing a segment", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
  });
});
