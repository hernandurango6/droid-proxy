import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionFile = path.join(repoRoot, "resources", "bin", "VERSION");
const binaryPath = path.join(repoRoot, "resources", "bin", "cli-proxy-api.exe");

function readPinnedVersion() {
  const raw = fs.readFileSync(versionFile, "utf8").trim();
  const match = raw.match(/(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Invalid VERSION pin at ${versionFile}`);
  }
  return match[1];
}

function readBinaryVersion() {
  let output = "";
  try {
    output = execFileSync(binaryPath, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    output = `${stdout}\n${stderr}`;
  }

  const match = output.match(/CLIProxyAPI Version:\s*(\d+\.\d+\.\d+)/i);
  if (!match) {
    throw new Error(`Could not parse cli-proxy-api version from output: ${output.trim()}`);
  }
  return match[1];
}

const pinned = readPinnedVersion();
const bundled = readBinaryVersion();

if (pinned !== bundled) {
  console.error(`VERSION pin mismatch: pin=${pinned} bundled=${bundled}`);
  process.exit(1);
}

console.log(`Backend version pin OK (${bundled})`);