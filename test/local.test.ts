import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildLocalCard, parseRemote } from "../src/index.js";

describe("parseRemote", () => {
  it("parses https and ssh remotes, stripping .git", () => {
    expect(parseRemote("https://github.com/abdulmunimjemal/shipcard.git")).toEqual(
      { owner: "abdulmunimjemal", name: "shipcard" },
    );
    expect(parseRemote("git@github.com:abdulmunimjemal/shipcard.git")).toEqual({
      owner: "abdulmunimjemal",
      name: "shipcard",
    });
  });

  it("returns null for unrecognizable input", () => {
    expect(parseRemote("not-a-url")).toBeNull();
  });
});

describe("buildLocalCard", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "shipcard-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads package.json and git origin and scans extensions", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@scope/widget", description: "A widget." }),
    );
    mkdirSync(join(dir, ".git"));
    writeFileSync(
      join(dir, ".git", "config"),
      '[remote "origin"]\n\turl = git@github.com:acme/widget.git\n',
    );
    writeFileSync(join(dir, "index.ts"), "export const a = 1;\n".repeat(50));
    writeFileSync(join(dir, "helper.js"), "module.exports = 1;\n");

    const card = buildLocalCard(dir);
    // Name strips the npm scope; owner comes from the git remote.
    expect(card.name).toBe("widget");
    expect(card.owner).toBe("acme");
    expect(card.description).toBe("A widget.");
    expect(card.languages.map((l) => l.name)).toContain("TypeScript");
    expect(card.languages.map((l) => l.name)).toContain("JavaScript");
  });

  it("skips node_modules and .git during the scan", () => {
    writeFileSync(join(dir, "main.py"), "print(1)\n");
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "junk.py"), "x".repeat(100000));

    const card = buildLocalCard(dir);
    const py = card.languages.find((l) => l.name === "Python");
    // node_modules content must not inflate the Python bytes.
    expect(py?.percent).toBe(100);
  });

  it("falls back to the directory name when no package.json exists", () => {
    writeFileSync(join(dir, "main.go"), "package main\n");
    const card = buildLocalCard(dir);
    expect(card.owner).toBe("local");
    expect(card.name.length).toBeGreaterThan(0);
    expect(card.languages[0].name).toBe("Go");
  });
});
