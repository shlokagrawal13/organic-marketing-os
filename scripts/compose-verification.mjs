import { randomBytes, createHash } from "node:crypto";

export function fixtureDockerEnv(parent) {
  const env = { ...parent };
  // Shell variables override --env-file interpolation. Never let inherited
  // development/production credentials replace the generated fixture secrets.
  for (const key of [
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "POSTGRES_PASSWORD",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "COMPOSE_FILE",
    "COMPOSE_ENV_FILES",
    "COMPOSE_PROFILES",
    "COMPOSE_PROJECT_NAME",
  ])
    delete env[key];
  return env;
}

export function fixtureProject(
  suffix = randomBytes(8).toString("hex"),
  restored = false,
) {
  if (!/^[a-f0-9]{16}$/.test(suffix))
    throw new Error("Invalid disposable fixture identity.");
  return `omos-compose-verify-${suffix}${restored ? "-restore" : ""}`;
}
export function assertFixtureProject(project) {
  if (!/^omos-compose-verify-[a-f0-9]{16}(?:-restore)?$/.test(project))
    throw new Error("Only generated disposable Compose projects are allowed.");
  return project;
}
export function assertFixtureRestoreProject(project) {
  assertFixtureProject(project);
  if (!project.endsWith("-restore"))
    throw new Error(
      "Database reset/interruption requires a disposable restore target.",
    );
  return project;
}
export function assertFixtureConfig(config, project, envPath) {
  assertFixtureProject(project);
  if (config.name !== project) throw new Error("Unexpected Compose project.");
  for (const service of Object.values(config.services)) {
    if (service.container_name)
      throw new Error("Fixed container names are not disposable.");
    for (const mount of service.volumes || []) {
      if (
        mount.type !== "volume" ||
        !config.volumes?.[mount.source]?.name?.startsWith(project + "_")
      )
        throw new Error("Fixture may mount only its own named volumes.");
    }
    for (const file of service.env_file || []) {
      if ((typeof file === "string" ? file : file.path) !== envPath)
        throw new Error("Fixture must not read the real environment file.");
    }
    for (const port of service.ports || []) {
      if (port.host_ip !== "127.0.0.1")
        throw new Error("Fixture ports must stay on loopback.");
    }
  }
  for (const volume of Object.values(config.volumes || {})) {
    if (volume.external || !volume.name?.startsWith(project + "_"))
      throw new Error("Fixture must not use existing/external volumes.");
  }
  for (const network of Object.values(config.networks || {})) {
    if (network.external || !network.name?.startsWith(project + "_"))
      throw new Error("Fixture must not use existing/external networks.");
  }
  return true;
}
export const checksum = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function redact(text, secrets) {
  return secrets
    .filter(Boolean)
    .reduce(
      (s, value) => s.replaceAll(value, "[fixture-secret]"),
      String(text),
    );
}
