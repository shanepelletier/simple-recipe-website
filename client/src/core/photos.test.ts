import { describe, expect, it } from "vitest";

import { PHOTO_ACCEPT, photoProblem } from "./photos";

const file = (name: string, size = 1000) => ({ name, size });

describe("photoProblem", () => {
  it("accepts every extension the server allows", () => {
    for (const name of ["a.jpg", "a.jpeg", "a.png", "a.webp"]) {
      expect(photoProblem(file(name))).toBeNull();
    }
  });

  it("ignores the case of the extension", () => {
    // A phone that names its files IMG_0001.JPG is not an edge case, and the
    // server lowercases before comparing too.
    expect(photoProblem(file("IMG_0001.JPG"))).toBeNull();
  });

  it("refuses a type the server would refuse", () => {
    expect(photoProblem(file("animation.gif"))).toBe("Image must be a JPG, PNG, or WebP file.");
  });

  it("refuses a file over the size cap, and states the cap", () => {
    expect(photoProblem(file("big.jpg", 5 * 1024 * 1024 + 1))).toBe(
      "Image must be smaller than 5 MB.",
    );
  });

  it("allows a file exactly on the cap, as the server does", () => {
    // The server compares with >, so the boundary belongs to the user.
    expect(photoProblem(file("exact.jpg", 5 * 1024 * 1024))).toBeNull();
  });

  it("offers the file dialog the same list it validates against", () => {
    expect(PHOTO_ACCEPT).toBe(".jpg,.jpeg,.png,.webp");
  });
});
