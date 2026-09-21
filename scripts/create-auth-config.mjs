import { generateKeyPair, exportJWK } from "jose";
import { writeFile } from "node:fs/promises";

const issuer = process.argv[2];
if (!issuer || new URL(issuer).origin !== issuer) throw new Error("Supply the exact app origin, without a trailing slash: node scripts/create-auth-config.mjs https://your-app.example");
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
const kid = crypto.randomUUID();
const privateJwk = { ...await exportJWK(privateKey), kid };
const jwks = { keys: [{ ...await exportJWK(publicKey), kid, alg: "RS256", use: "sig" }] };
const content = `AUTH_ISSUER=${issuer}\nAUTH_SESSION_VERSION=1\nAUTH_PRIVATE_JWK='${JSON.stringify(privateJwk)}'\nAUTH_JWKS='${JSON.stringify(jwks)}'\n`;
await writeFile(".env.auth", content, { flag: "wx", mode: 0o600 });
console.log("Wrote .env.auth (gitignored). Keep AUTH_PRIVATE_JWK only in the Next.js server environment. Copy the other three settings to Next.js and Convex. Existing files are never overwritten.");
