import { describe, expect, it } from "vitest";
import { appendQueryParams, toManagementPath } from "@/management/adapter/ipcTransport";

describe("ipcTransport", () => {
  it("prefixes relative management API paths", () => {
    expect(toManagementPath("/auth-files")).toBe("/v0/management/auth-files");
    expect(toManagementPath("version")).toBe("/v0/management/version");
  });

  it("keeps already-prefixed paths unchanged", () => {
    expect(toManagementPath("/v0/management/version")).toBe("/v0/management/version");
  });

  it("appends query params for DELETE and GET helpers", () => {
    expect(appendQueryParams("/v0/management/auth-files", { all: true })).toBe(
      "/v0/management/auth-files?all=true"
    );
  });
});