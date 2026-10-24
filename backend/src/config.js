import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
export function readConfig(env = process.env) {
  const missing = ["MONGODB_URI", "JWT_SECRET", "FRONTEND_ORIGIN"].filter(
    (k) => !env[k],
  );
  if (missing.length)
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}. See .env.example.`,
    );
  if (env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  const origin = new URL(env.FRONTEND_ORIGIN).origin;
  if (env.NODE_ENV === "production" && !origin.startsWith("https://"))
    throw new Error("Production FRONTEND_ORIGIN must use HTTPS");
  const proxyHops=env.TRUST_PROXY_HOPS === undefined ? (env.RENDER === "true" ? 1 : 0) : Number(env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 10) throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 10");
  return {
    proxyHops,
    mailConfigPath:
      env.MAIL_CONFIG_PATH ||
      fileURLToPath(new URL("../.env.mail", import.meta.url)),
    mongoUri: env.MONGODB_URI,
    secret: env.JWT_SECRET,
    origin,
    production: env.NODE_ENV === "production",
    port: Number(env.PORT || 4000),
  };
}
