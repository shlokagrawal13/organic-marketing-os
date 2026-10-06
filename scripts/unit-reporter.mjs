// Require a complete Node test summary; an exit code alone is not evidence.
// https://nodejs.org/api/test.html#event-testsummary
import { mkdirSync, writeFileSync } from "node:fs";

export default async function* report(source) {
  const passed = [],
    failed = [],
    summaries = [];
  let finalSummary;
  try {
    for await (const event of source) {
      const { type, data } = event;
      if (type === "test:pass") {
        passed.push({
          name: data.name,
          file: data.file,
          durationMs: data.details?.duration_ms,
        });
        if (/decoded.*(frames|exports)/.test(data.name))
          yield `✔ ${data.name} (${data.details.duration_ms}ms)\n`;
      } else if (type === "test:fail") {
        const item = {
          name: data.name,
          file: data.file,
          error: String(data.details?.error),
          durationMs: data.details?.duration_ms,
        };
        failed.push(item);
        yield `✖ ${item.name}\n${data.details?.error?.stack || item.error}\n`;
      } else if (type === "test:diagnostic" && /HarfBuzz/.test(data.message)) {
        yield `ℹ ${data.message}\n`;
      } else if (type === "test:summary") {
        summaries.push(data);
        if (!data.file) finalSummary = data;
      }
    }
  } finally {
    // Keep all case receipts locally even if the stream is interrupted. No env,
    // credentials, provider payloads or raw runtime logs enter this receipt.
    mkdirSync(".local", { recursive: true });
    writeFileSync(
      ".local/unit-receipts.json",
      JSON.stringify(
        { passed, failed, summaries, finalSummary: finalSummary || null },
        null,
        2,
      ) + "\n",
    );
  }
  if (!finalSummary)
    throw new Error(
      "Unit verification incomplete: final cumulative Node summary is missing.",
    );
  const c = finalSummary.counts;
  yield `ℹ tests ${c.tests}\nℹ suites ${c.suites}\nℹ pass ${c.passed}\nℹ fail ${c.failed}\nℹ cancelled ${c.cancelled}\nℹ skipped ${c.skipped}\nℹ todo ${c.todo}\nℹ duration_ms ${finalSummary.duration_ms}\n`;
  if (
    !finalSummary.success ||
    !c.tests ||
    c.passed !== c.tests ||
    c.failed ||
    c.cancelled ||
    c.skipped ||
    c.todo
  )
    throw new Error(
      "Unit verification did not run and pass every selected case.",
    );
}
