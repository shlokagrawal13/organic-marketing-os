// Isolated Compose fixture only. No upstream calls, real keys or business data.
import { createServer } from "node:http";
export function createRecoveryProvider() {
  const calls = {};
  return createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url === "/stats") {
      res.end(JSON.stringify(calls));
      return;
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
