// Isolated Compose fixture only. No upstream calls, real keys or business data.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
export function createRecoveryProvider() {
  const calls = {};
  const effects = new Map();
  return createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
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
