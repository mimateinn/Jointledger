import { describe, expect, it } from "vitest";
import { isPostgresUrl, sqliteFilePath } from "./dialect";

describe("database url dialect", () => {
  it("picks postgres only for postgres:// or postgresql://", () => {
    expect(isPostgresUrl("postgres://ledger:ledger@localhost:5432/joint_ledger")).toBe(true);
    expect(isPostgresUrl("postgresql://ledger:ledger@localhost:5432/joint_ledger")).toBe(true);
    expect(isPostgresUrl("file:./data/joint-ledger.sqlite")).toBe(false);
    expect(isPostgresUrl("./data/joint-ledger.sqlite")).toBe(false);
  });

  it("strips file: for the sqlite path", () => {
    expect(sqliteFilePath("file:./data/joint-ledger.sqlite")).toBe("./data/joint-ledger.sqlite");
    expect(sqliteFilePath("./data/joint-ledger.sqlite")).toBe("./data/joint-ledger.sqlite");
  });
});
