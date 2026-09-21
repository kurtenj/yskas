import type { AuthConfig } from "convex/server";

export default {
  providers: [{
    type: "customJwt",
    issuer: process.env.AUTH_ISSUER!,
    applicationID: "convex",
    algorithm: "RS256",
    jwks: `data:application/json,${encodeURIComponent(process.env.AUTH_JWKS!)}`,
  }],
} satisfies AuthConfig;
