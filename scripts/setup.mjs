import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; it was not changed.");
  process.exit(0);
}
const secret = () => randomBytes(32).toString("hex");
const dbPassword = secret();
writeFileSync(
  ".env",
  `NODE_ENV=development\nWEB_ORIGIN=http://localhost:3000\nCOOKIE_SECURE=false\nAPI_PORT=4000\nPOSTGRES_PASSWORD=${dbPassword}\nDATABASE_URL=postgresql://marketing:${dbPassword}@localhost:5432/marketing?schema=public\nREDIS_URL=redis://localhost:6379\nENCRYPTION_KEY=${secret()}\nSMTP_HOST=localhost\nSMTP_PORT=1025\nMAIL_FROM=Marketing OS <hello@localhost>\nAI_PRIMARY_KEY=\nAI_PRIMARY_URL=https://api.openai.com/v1\nAI_PRIMARY_MODEL=\nAI_FALLBACK_KEY=\nAI_FALLBACK_URL=\nAI_FALLBACK_MODEL=\nS3_ENDPOINT=http://localhost:9000\nS3_REGION=us-east-1\nS3_BUCKET=marketing-assets\nS3_ACCESS_KEY=marketing\nS3_SECRET_KEY=${secret()}\n`,
  { mode: 0o600 },
);
console.log(
  "Created .env with unique local secrets. Start the services with docker compose up --build.",
);
