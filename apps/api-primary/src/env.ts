export type Env = {
  NODE_ENV: string;
  PORT: number;
  AUTH_JWT_SECRET: string;
  CORS_ORIGIN: string | string[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Set it before starting the server.`,
    );
  }
  return value.trim();
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${value}". Expected an integer 1–65535.`);
  }
  return port;
}

function parseCorsOrigin(value: string): string | string[] {
  if (value === "*") return "*";
  const origins = value.split(",").map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must be '*' or a comma-separated list of origins.");
  }
  return origins.length === 1 ? origins[0]! : origins;
}

export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const portRaw = process.env.PORT?.trim() || "3000";

  return {
    NODE_ENV: nodeEnv,
    PORT: parsePort(portRaw),
    AUTH_JWT_SECRET: requireEnv("AUTH_JWT_SECRET"),
    CORS_ORIGIN: parseCorsOrigin(
      process.env.CORS_ORIGIN?.trim() || "http://localhost:5173",
    ),
  };
}
