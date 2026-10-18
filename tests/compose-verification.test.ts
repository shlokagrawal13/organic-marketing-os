import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixtureProject,
  assertFixtureProject,
  assertFixtureConfig,
  redact,
  fixtureDockerEnv,
} from "../scripts/compose-verification.mjs";
const project = fixtureProject("0123456789abcdef"),
  envPath = "/fixture/private.env";
const config = () => ({
  name: project,
  services: {
    postgres: { volumes: [{ type: "volume", source: "postgres_data" }] },
    api: { env_file: [{ path: envPath }], ports: [{ host_ip: "127.0.0.1" }] },
  },
  volumes: { postgres_data: { name: project + "_postgres_data" } },
  networks: { default: { name: project + "_default" } },
});
test("Compose destructive operations accept only generated source/restore identities", () => {
  assert.equal(assertFixtureProject(project), project);
  assert.equal(
    assertFixtureProject(fixtureProject("0123456789abcdef", true)),
    project + "-restore",
  );
  for (const invalid of [
    "organic-marketing-os",
    "omos-compose-verify-123",
    "omos-compose-verify-0123456789abcdef-other",
    "../data",
    project + "\n",
  ])
    assert.throws(() => assertFixtureProject(invalid));
  assert.throws(() => fixtureProject("../../production"));
});
test("Compose fixture rejects populated volumes, bind mounts and external networks", () => {
  assert.equal(assertFixtureConfig(config(), project, envPath), true);
  for (const mutation of [
    (c) => (c.name = "organic-marketing-os"),
    (c) => (c.volumes.postgres_data.external = true),
    (c) =>
      (c.volumes.postgres_data.name = "organic-marketing-os_postgres_data"),
    (c) => (c.services.postgres.volumes[0].type = "bind"),
    (c) => (c.services.postgres.container_name = "populated"),
    (c) => (c.networks.default.external = true),
    (c) => (c.networks.default.name = "organic-marketing-os_default"),
  ]) {
    const c: any = config();
    mutation(c);
    assert.throws(() => assertFixtureConfig(c, project, envPath));
  }
});
test("Compose fixture rejects real env files and publicly bound ports", () => {
  const parent = {
    POSTGRES_PASSWORD: "parent-db",
    S3_ACCESS_KEY: "parent-s3",
    S3_SECRET_KEY: "parent-secret",
    DOCKER_HOST: "tcp://existing",
    COMPOSE_ENV_FILES: "/real/.env",
    COMPOSE_FILE: "/real/compose.yaml",
    COMPOSE_PROFILES: "real",
    COMPOSE_PROJECT_NAME: "real",
    HTTP_PROXY: "configured-proxy",
    PATH: "configured-path",
  };
  assert.deepEqual(fixtureDockerEnv(parent), {
    HTTP_PROXY: "configured-proxy",
    PATH: "configured-path",
  });
  assert.equal(parent.POSTGRES_PASSWORD, "parent-db");
  for (const mutation of [
    (c) => (c.services.api.env_file = ["/project/.env"]),
    (c) => (c.services.api.ports[0].host_ip = "0.0.0.0"),
    (c) => delete c.services.api.ports[0].host_ip,
  ]) {
    const c: any = config();
    mutation(c);
    assert.throws(() => assertFixtureConfig(c, project, envPath));
  }
});
test("Compose diagnostics remove every generated secret without dropping public context", () => {
  assert.equal(
    redact("connection s3-secret DB db-secret twice s3-secret", [
      "s3-secret",
      "db-secret",
      "",
    ]),
    "connection [fixture-secret] DB [fixture-secret] twice [fixture-secret]",
  );
});
