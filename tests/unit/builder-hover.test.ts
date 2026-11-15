import { describe, expect, it } from "vitest";
import { hasHover, readHover, readStyle, writeHover, writeStyle, type Scales } from "@/lib/builder/class-groups";
import { forcedSelector } from "@/components/builder/hover-preview";

const scales: Scales = { colors: [{ name: "primary", value: "#123" }, { name: "accent", value: "#f60" }], textSizes: ["sm", "lg"], fonts: [], radii: ["md"] };

describe("hover styles", () => {
  it("writes hover classes beside the normal ones and reads them back", () => {
    let c = "vt:bg-primary vt:p-4";
    c = writeHover(c, scales, "bg", "accent");
    c = writeHover(c, scales, "shadow", "lg");
    c = writeHover(c, scales, "move", "lift");
    expect(c.split(" ")).toEqual(expect.arrayContaining(["vt:bg-primary", "vt:hover:bg-accent", "vt:hover:shadow-lg", "vt:hover:-translate-y-1", "vt:transition"]));
    expect(readHover(c, scales)).toEqual({ bg: "accent", color: undefined, borderColor: undefined, shadow: "lg", opacity: undefined, move: "lift" });
    // The normal look is untouched, and normal edits leave the hover look alone.
    expect(readStyle(c, scales).bg).toBe("primary");
    expect(readHover(writeStyle(c, scales, "bg", "accent"), scales).bg).toBe("accent");
  });

  it("replaces and clears one hover control without touching the design's other variants", () => {
    const design = "vt:hover:text-primary vt:md:hover:bg-primary vt:group-hover:opacity-50 vt:transition-colors";
    let c = writeHover(design, scales, "color", "accent");
    expect(c).toContain("vt:hover:text-accent");
    expect(c).not.toContain("vt:hover:text-primary");
    // It already eases, so no extra transition.
    expect(c).not.toMatch(/(^| )vt:transition( |$)/);
    c = writeHover(c, scales, "color", undefined);
    expect(c.split(" ").sort()).toEqual(["vt:group-hover:opacity-50", "vt:md:hover:bg-primary", "vt:transition-colors"]);
    expect(hasHover(c, scales)).toBe(false);
  });

  it("shows movement it doesn't offer as the design's own, and keeps it", () => {
    const c = "vt:hover:translate-y-2";
    expect(readHover(c, scales).move).toBe("custom");
    expect(writeHover(c, scales, "move", "custom")).toBe(c);
    expect(writeHover(c, scales, "move", "grow")).toContain("vt:hover:scale-105");
  });
});

describe("forced hover preview", () => {
  it("rewrites :hover for the forced attribute", () => {
    expect(forcedSelector(".vt\\:hover\\:bg-accent:hover")).toBe(".vt\\:hover\\:bg-accent[data-vt-force-hover]");
    expect(forcedSelector(".group:hover .title, a:hover")).toBe(".group[data-vt-force-hover] .title, a[data-vt-force-hover]");
    expect(forcedSelector(".card:focus")).toBeNull();
    expect(forcedSelector(".card[data-vt-force-hover]")).toBeNull();
  });
});
