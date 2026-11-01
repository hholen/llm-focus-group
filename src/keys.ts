import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

let envLoaded = false;

function loadDotEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  if (existsSync(".env")) process.loadEnvFile(".env");
}

function fromKeychain(name: string): string | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    const value = execFileSync("security", ["find-generic-password", "-s", name, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return value.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Environment or .env first, then the macOS keychain, where the service name is the variable name. */
export function getKey(name: string): string {
  loadDotEnv();
  const value = process.env[name] || fromKeychain(name);
  if (!value) throw new Error(`Missing ${name}. Set it in your environment or .env, or add it to the macOS keychain.`);
  process.env[name] = value; // one keychain lookup per process
  return value;
}
