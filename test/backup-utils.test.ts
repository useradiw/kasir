/**
 * backup-utils.test.ts — validateBackup (lib/backup-utils.ts). Pure.
 *
 * This is the only gate between a malformed file and a restore into the
 * production database, so the messages below are the exact strings the
 * restore screen shows the owner.
 */

import { describe, it, expect } from "vitest";
import { validateBackup } from "@/lib/backup-utils";

describe("validateBackup", () => {
  it("accepts a valid backup and reports table counts", () => {
    const result = validateBackup({
      tables: {
        staff: [{ id: "s1" }, { id: "s2" }],
        menuItems: [],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.tables).toEqual(["staff", "menuItems"]);
    expect(result.counts).toEqual({ staff: 2, menuItems: 0 });
  });

  it("rejects null as not valid JSON data", () => {
    const result = validateBackup(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("File bukan objek JSON yang valid");
  });

  it("rejects a string", () => {
    const result = validateBackup("tables: {}");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("File bukan objek JSON yang valid");
  });

  it("rejects an array — it must be an object with a tables field", () => {
    const result = validateBackup([{ tables: {} }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "tables" tidak ditemukan atau tidak valid');
  });

  it("rejects an empty object as missing the tables field", () => {
    const result = validateBackup({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "tables" tidak ditemukan atau tidak valid');
  });

  it("rejects a tables field that is not an object", () => {
    const result = validateBackup({ tables: "staff,menuItems" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "tables" tidak ditemukan atau tidak valid');
  });

  it("rejects a table whose value is not an array and keeps the good tables", () => {
    const result = validateBackup({
      tables: {
        staff: "bukan array",
        menuItems: [{ id: "m1" }],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Tabel "staff" bukan array');
    expect(result.tables).toEqual(["menuItems"]);
    expect(result.counts).toEqual({ menuItems: 1 });
  });

  it("currently passes a backup with zero tables — there is no required-table check", () => {
    // Characterization, not endorsement: validateBackup only rejects malformed
    // SHAPES, not incomplete content. A file like { "tables": {} } is treated
    // as valid and the restore screen simply shows an empty table list. If a
    // required-table check is ever added, this is the test to flip.
    const result = validateBackup({ tables: {} });
    expect(result.valid).toBe(true);
    expect(result.tables).toEqual([]);
  });
});
