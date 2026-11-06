import { describe, expect, test } from "vitest";
import { getAvailableNoteName } from "~/client/modules/notes/parsers/NoteName";

describe("getAvailableNoteName", () => {
  test("uses the base name while no note has it", () => {
    expect(getAvailableNoteName("Untitled note", ["Lisbon trip"])).toBe(
      "Untitled note",
    );
  });

  test("numbers the next untitled note, ignoring case", () => {
    expect(
      getAvailableNoteName("Untitled note", [
        "untitled note",
        "Untitled Note 2",
      ]),
    ).toBe("Untitled note 3");
  });
});
