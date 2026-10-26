// Isolated Compose fixture only. Optional read-only fixture receipt proxy;
// no live-provider calls, real keys or business data.
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
export function createRecoveryProvider({ readReceipt } = {}) {
  const calls = {};
  const effects = new Map();
  const workerBarriers = new Map(),
    mediaEffects = new Map();
  return createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (readReceipt && /^\/(worker-|historical-effects)/.test(req.url || "")) {
      if (
        req.method !== "GET" ||
        !/^\/(?:worker-barriers\/[a-f0-9]{16}|historical-effects\/history-[a-f0-9]{16})$/.test(
          req.url,
        )
      ) {
        res.writeHead(405);
        res.end("{}");
        return;
      }
      try {
        res.end(JSON.stringify(await readReceipt(req.url)));
      } catch {
        res.writeHead(503);
        res.end("{}");
      }
      return;
    }
    if (req.url?.startsWith("/worker-")) {
      try {
        const match =
          /^\/(worker-barriers|worker-media)\/([a-f0-9]{16})(?:\/(render|media))?$/.exec(
            req.url,
          );
        if (!match) throw Error("Invalid barrier identity");
        const [, route, nonce, kind] = match;
        if (req.method === "GET" && route === "worker-barriers" && !kind) {
          res.end(
            JSON.stringify({
              barriers: [...(workerBarriers.get(nonce)?.values() || [])],
              media: mediaEffects.get(nonce) || null,
            }),
          );
          return;
        }
        if (req.method !== "POST") throw Error("Invalid method");
        let body = "";
        for await (const part of req) {
          body += part;
          if (body.length > 10000) throw Error("Large barrier");
        }
        const value = JSON.parse(body);
        if (route === "worker-media" && !kind) {
          if (
            value.model !== "fixture-image" ||
            value.prompt !== "COMPOSE_RECOVERY_PHYSICAL_AMBIGUOUS" ||
            !/^[a-f0-9-]{36}:[a-f0-9-]{36}$/.test(
              req.headers["idempotency-key"] || "",
            )
          )
            throw Error("Invalid fixture generation");
          const hash = createHash("sha256").update(body).digest("hex");
          const prior = mediaEffects.get(nonce);
          if (prior) {
            prior.submissionAttempts++;
            res.writeHead(409);
            res.end("{}");
            return;
          }
          mediaEffects.set(nonce, {
            idempotencyKey: req.headers["idempotency-key"],
            requestSha256: hash,
            providerRequestId: randomUUID(),
            acceptedCalls: 1,
            submissionAttempts: 1,
            responseHeld: true,
            acceptedAtUtc: new Date().toISOString(),
          });
          // Intentionally leave the actual adapter request unacknowledged to the worker.
          // The observer reads the provider receipt, then kills the worker process.
          return;
        }
        if (
          route !== "worker-barriers" ||
          !kind ||
          !Number.isInteger(value.pid) ||
          value.pid < 1 ||
          !Number.isInteger(value.bytes) ||
          value.bytes < 100 ||
          !/^[a-f0-9]{64}$/.test(value.sha256) ||
          typeof value.key !== "string" ||
          !value.key.startsWith("7cdd0796-a51e-442a-aab9-111111111111/")
        )
          throw Error("Invalid barrier receipt");
        if (
          value.boundary !==
          (kind === "render"
            ? "encoded-segment-put-acknowledged"
            : "retained-output-read-before-ingest")
        )
          throw Error("Invalid boundary");
        const rows = workerBarriers.get(nonce) || new Map();
        if (rows.has(kind)) {
          res.writeHead(409);
          res.end("{}");
          return;
        }
        rows.set(kind, {
          kind,
          ...value,
          observedAtUtc: new Date().toISOString(),
        });
        workerBarriers.set(nonce, rows);
        res.writeHead(201);
        res.end("{}");
        return;
      } catch {
        res.writeHead(400);
        res.end("{}");
        return;
      }
    }
    if (req.method === "GET" && req.url === "/stats") {
      res.end(JSON.stringify(calls));
      return;
    }
    if (req.url?.startsWith("/historical-effects")) {
      try {
        if (
          req.method === "GET" &&
          /^\/historical-effects\/history-[a-f0-9]{16}$/.test(req.url)
        ) {
          const effect = effects.get(req.url.split("/").at(-1));
          res.writeHead(effect ? 200 : 404);
          res.end(JSON.stringify(effect ?? {}));
          return;
        }
        if (req.method !== "POST" || req.url !== "/historical-effects") {
          res.writeHead(404);
          res.end("{}");
          return;
        }
        let body = "";
        for await (const part of req) {
          body += part;
          if (body.length > 10000) throw Error("Large effect request");
        }
        const { operationId, requestHash } = JSON.parse(body);
        if (
          !/^history-[a-f0-9]{16}$/.test(operationId) ||
          !/^[a-f0-9]{64}$/.test(requestHash)
        )
          throw Error("Invalid effect identity");
        const prior = effects.get(operationId);
        if (prior) {
          prior.submissionAttempts++;
          res.writeHead(prior.requestHash === requestHash ? 200 : 409);
          res.end(JSON.stringify(prior));
          return;
        }
        if (effects.size >= 32) throw Error("Fixture effect capacity");
        const effect = {
          operationId,
          requestHash,
          provider: "synthetic-history-provider",
          providerOperationId: randomUUID(),
          status: "CONFIRMED",
          acceptedCalls: 1,
          submissionAttempts: 1,
        };
        effects.set(operationId, effect);
        res.writeHead(201);
        res.end(JSON.stringify(effect));
        return;
      } catch {
        res.writeHead(400);
        res.end("{}");
        return;
      }
    }
    if (req.method !== "POST" || req.url !== "/chat/completions") {
      res.writeHead(404);
      res.end("{}");
      return;
    }
    try {
      let body = "";
      for await (const part of req) {
        body += part;
        if (body.length > 100000) throw Error("Large fixture request");
      }
      const request = JSON.parse(body),
        input = JSON.parse(request.messages?.[1]?.content || "{}").input;
      if (!input?.prompt?.startsWith("COMPOSE_RECOVERY_"))
        throw Error("Unexpected fixture request");
      calls[input.prompt] = (calls[input.prompt] || 0) + 1;
      const output = {
        title: "Synthetic restored queue draft",
        platform: "LinkedIn",
        format: "Text",
        hook: "Synthetic recovery fixture",
        body: "Synthetic provider output for cross-store recovery verification only.",
        cta: "Review this fixture",
        scenes: [],
      };
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(output) } }],
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
      );
    } catch {
      res.writeHead(400);
      res.end("{}");
    }
  });
}
