// Isolated HTTP contract fixture. Never imported by application runtime code.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
export function generationFixture() {
  const calls = {},
    polls = {},
    videos = new Map();
  return createServer(async (req, res) => {
    const json = (value) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    if (req.url === "/stats") return json(calls);
    if (req.url === "/poll-stats") return json(polls);
    if (req.headers.authorization !== "Bearer isolated-media-fixture") {
      res.writeHead(401);
      return res.end();
    }
    res.setHeader("x-request-id", "req_isolated_contract_fixture");
    if (req.method === "POST") {
      const parts = [];
      for await (const part of req) parts.push(Buffer.from(part));
      const body = Buffer.concat(parts);
      const raw = body.toString("latin1");
      let input;
      try {
        input =
          req.url === "/v1/videos" || req.url === "/v1/images/edits"
            ? { prompt: /name="prompt"\r\n\r\n([^\r]*)/.exec(raw)?.[1] }
            : JSON.parse(body.toString("utf8"));
      } catch {
        res.writeHead(400);
        return res.end();
      }
      const prompt = input.prompt || input.input;
      if (req.url === "/v1/images/edits") {
        const expected = readFileSync(".local/media-fixtures/product.png");
        const imageParts = raw.match(/name="image\[\]"/g) || [];
        if (
          !req.headers["content-type"]?.startsWith("multipart/form-data;") ||
          imageParts.length !== 2 ||
          !body.includes(expected) ||
          !raw.includes('name="model"') ||
          !raw.includes('name="size"\r\n\r\n1024x1536') ||
          !raw.includes('name="quality"\r\n\r\nlow') ||
          !raw.includes('name="background"\r\n\r\ntransparent')
        ) {
          res.writeHead(400);
          return res.end();
        }
      }
      calls[prompt] = (calls[prompt] || 0) + 1;
      if (prompt.startsWith("DROP:")) return req.socket.destroy();
      if (prompt.startsWith("HOLD:")) {
        const timer = setTimeout(() => res.end("{}"), 90000);
        res.on("close", () => clearTimeout(timer));
        return;
      }
      if (req.url === "/v1/videos") {
        const id = `video_fixture_${videos.size + 1}`;
        videos.set(id, { prompt, polls: 0 });
        return json({ id, status: "queued" });
      }
      if (req.url === "/v1/audio/speech") {
        res.setHeader("Content-Type", "audio/wav");
        return res.end(readFileSync(".local/media-fixtures/tone.wav"));
      }
      return json({
        data: [
          {
            b64_json: prompt.startsWith("INVALID:")
              ? Buffer.from("not an image").toString("base64")
              : readFileSync(".local/media-fixtures/product.png").toString(
                  "base64",
                ),
          },
        ],
      });
    }
    const match = /^\/v1\/videos\/(video_fixture_\d+)(\/content)?$/.exec(
      req.url || "",
    );
    const item = match && videos.get(match[1]);
    if (!item) {
      res.writeHead(404);
      return res.end();
    }
    if (match[2]) {
      res.setHeader("Content-Type", "video/mp4");
      return res.end(readFileSync(".local/media-fixtures/clip.mp4"));
    }
    item.polls++;
    polls[item.prompt] = (polls[item.prompt] || 0) + 1;
    // Fault-test barrier: keep the first poll active until the worker is killed.
    // Later polls of the SAME receipt complete normally. Never used by runtime.
    if (item.prompt.startsWith("HOLD_POLL_ONCE:") && item.polls === 1) {
      const timer = setTimeout(() => res.end("{}"), 90000);
      res.on("close", () => clearTimeout(timer));
      return;
    }
    if (item.prompt.startsWith("POLL_ERROR:") && item.polls === 1) {
      res.writeHead(503);
      return res.end();
    }
    return json({
      id: match[1],
      status: item.prompt.startsWith("FAIL:")
        ? "failed"
        : item.polls < 2
          ? "in_progress"
          : "completed",
    });
  });
}
