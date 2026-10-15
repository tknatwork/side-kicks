import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * The plugin socket's pairing code. Nothing on the wire tells the real plugin
 * from a web page posing as it (both are loopback with Origin "null": the
 * plugin UI and a page's sandboxed iframe), so the plugin proves itself with a
 * secret it can only get out of band: the user types this code into the plugin
 * window once, and the plugin sends it on every connection. Web pages can't
 * read the file, and they can't call MCP tools (get_pairing_code).
 *
 * Stored at ~/.figma-limitless-mcp/pairing-token (0600), read on every check
 * so a code rotated by any client takes effect at once.
 */

/** No 0/O/1/I/L: the code is read aloud and typed. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 4;
const GROUP_LENGTH = 4;

export const pairingTokenPath = (): string => path.join(homedir(), ".figma-limitless-mcp", "pairing-token");

/** Pairing off: every plugin connection is trusted, as before pairing existed. */
export const pairingDisabled = (): boolean => /^(off|0|false|no)$/i.test(process.env.LIMITLESS_PAIRING ?? "");

const generateCode = (): string =>
  Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
  ).join("-");

/** Uppercase, separators dropped: what the user types is compared, not how. */
export const normalizeCode = (code: string): string => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

const writeCode = (file: string, code: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, code + "\n", { mode: 0o600 });
  chmodSync(file, 0o600);
};

/** The stored code, or undefined when the file is missing or unusable. */
const readCode = (file: string): string | undefined => {
  try {
    const code = readFileSync(file, "utf8").trim();
    return normalizeCode(code).length >= GROUPS * GROUP_LENGTH ? code : undefined;
  } catch {
    return undefined;
  }
};

/** The current code, created on first use. */
export const getPairingCode = (): string => {
  const file = pairingTokenPath();
  const existing = readCode(file);
  if (existing) return existing;
  const code = generateCode();
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    // Exclusive create: the leader (checking a plugin) and a follower (in
    // get_pairing_code) creating it at once must end up with the same code.
    writeFileSync(file, code + "\n", { mode: 0o600, flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const raced = readCode(file);
    if (raced) return raced;
    writeCode(file, code); // present but unusable: replace it
  }
  return code;
};

/** Replaces the code; plugins paired with the old one must pair again. */
export const rotatePairingCode = (): string => {
  const code = generateCode();
  writeCode(pairingTokenPath(), code);
  return code;
};

const digest = (s: string): Buffer => createHash("sha256").update(s).digest();

/** Constant-time check of a code a plugin presented. Fails closed: a code
 *  that can't be read or created pairs nothing (and never throws into the
 *  socket handler). */
export const isValidPairingCode = (presented: string | null | undefined): boolean => {
  if (pairingDisabled()) return true;
  if (!presented) return false;
  let expected: string;
  try {
    expected = getPairingCode();
  } catch (err) {
    console.error(`Pairing code unavailable (${pairingTokenPath()}): ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  return timingSafeEqual(digest(normalizeCode(presented)), digest(normalizeCode(expected)));
};
