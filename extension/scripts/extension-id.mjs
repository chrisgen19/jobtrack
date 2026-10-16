/**
 * Prints the Chrome extension ID that WXT_EXTENSION_KEY (a base64 SPKI
 * public key, from the environment or .env) produces. Put it in the web
 * app's EXTENSION_IDS. Pass --generate to print a fresh key pair instead.
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** Chrome's ID: first 128 bits of SHA-256(public key DER), hex digits mapped 0-f -> a-p. */
const idFromKey = (base64) =>
  [...createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex").slice(0, 32)]
    .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
    .join("");

if (process.argv.includes("--generate")) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  process.stdout.write(`WXT_EXTENSION_KEY=${key}\nExtension ID: ${idFromKey(key)}\n\n`);
  process.stdout.write(`${privateKey.export({ type: "pkcs8", format: "pem" })}`);
  process.stdout.write(
    "Keep the private key only if you want to pack .crx files; unpacked builds need just the public key.\n",
  );
} else {
  const fileEnv = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
  const key = process.env.WXT_EXTENSION_KEY || fileEnv.WXT_EXTENSION_KEY;
  if (!key) {
    process.stderr.write("WXT_EXTENSION_KEY is not set (copy .env.example to .env).\n");
    process.exit(1);
  }
  process.stdout.write(`${idFromKey(key)}\n`);
}
