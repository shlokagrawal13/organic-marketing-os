import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createRecoveryProvider } from "../scripts/compose-recovery-provider.mjs";
test("Synthetic historical effect receipts retain identity and reject conflicting replays", async () => {
  const server = createRecoveryProvider();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const operationId = "history-0123456789abcdef",
      requestHash = "a".repeat(64);
    const post = (body) =>
      fetch(base + "/historical-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post({ operationId: "unknown", requestHash })).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/historical-effects/" + operationId)).status,
      404,
    );
    const created = await post({ operationId, requestHash });
    assert.equal(created.status, 201);
    const receipt = await created.json();
    const repeat = await post({ operationId, requestHash });
    assert.equal(repeat.status, 200);
    assert.deepEqual(await repeat.json(), {
      ...receipt,
      submissionAttempts: 2,
    });
    assert.equal(
      (await post({ operationId, requestHash: "b".repeat(64) })).status,
      409,
    );
    const readback = await (
      await fetch(base + "/historical-effects/" + operationId)
    ).json();
    assert.deepEqual(readback, { ...receipt, submissionAttempts: 3 });
    assert.equal(readback.acceptedCalls, 1);
    assert.deepEqual(await (await fetch(base + "/stats")).json(), {});
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
