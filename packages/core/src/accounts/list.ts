import fs from "node:fs";
import path from "node:path";
import type { Account } from "./types";

export function readAccount(authDir: string, file: string): Account | null {
  try {
    const filePath = path.join(authDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      type?: string;
      email?: string;
      login?: string;
      disabled?: boolean;
    };
    return {
      file,
      type: data.type || "unknown",
      email: data.email || data.login || file,
      disabled: Boolean(data.disabled)
    };
  } catch {
    return null;
  }
}

export function getAccounts(authDir: string): Account[] {
  if (!fs.existsSync(authDir)) {
    return [];
  }

  return fs.readdirSync(authDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readAccount(authDir, file))
    .filter((account): account is Account => Boolean(account));
}

export function formatAccountsForCli(accounts: Account[]): string {
  if (accounts.length === 0) {
    return "No accounts found.";
  }

  return accounts
    .map((account) => `${account.type}\t${account.email}\t${account.file}${account.disabled ? "\tdisabled" : ""}`)
    .join("\n");
}