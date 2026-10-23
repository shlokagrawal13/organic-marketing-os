import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual entrypoint with deferred tool validation and isolated adapters.
// No database, queue, private bucket or subprocess is contacted by these cases.
function entrypoint() {
  let resolveTool!: () => void, rejectTool!: (error: Error) => void;
  const tool = new Promise<void>((resolve, reject) => {
    resolveTool = resolve;
    rejectTool = reject;
  });
  const calls = {
    runs: 0,
    databaseMutations: 0,
    dispatchReads: 0,
    exits: [] as number[],
    logs: [] as string[],
    timers: new Set<object>(),
    events: {} as Record<string, () => Promise<void>>,
    options: null as any,
  };
  let finishRun!: () => void;
  class Worker {
    constructor(_name, _processor, options) {
      calls.options = options;
      if (options.autorun !== false) void this.run();
    }
    run() {
      calls.runs++;
      return new Promise<void>((resolve) => {
        finishRun = resolve;
      });
    }
    on() {}
    async close() {
      finishRun?.();
    }
  }
  class Queue {
    async close() {}
  }
  class Redis {
    on() {}
    async set() {}
    async quit() {}
  }
  class PrismaClient {
    renderJob = {
      updateMany: async () => {
        calls.databaseMutations++;
        return { count: 0 };
      },
      findMany: async () => {
        calls.dispatchReads++;
        return [];
      },
    };
    async $disconnect() {}
  }
  const modules = {
    "reflect-metadata": {},
    "@prisma/client": { PrismaClient },
    bullmq: { Worker, Queue },
    ioredis: Redis,
    "node:crypto": { randomUUID: () => "unused" },
    "../../../packages/core/object-store": { ObjectStore: class {} },
    "../../../packages/core/ai": {},
    "../../../packages/core/media": {
      runProcess: async (binary, args, options) => {
        assert.equal(binary, "ffmpeg");
        assert.deepEqual(Array.from(args), ["-version"]);
        assert.equal(options.timeout, 5000);
        return tool;
      },
    },
    "../../../packages/core/renderer": {},
    "../../../packages/core/render-font": {},
  };
  const source = readFileSync(
    new URL("../apps/api/src/render-worker.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    },
    exports: {},
    process: {
      env: {},
      on: (name, fn) => {
        calls.events[name] = fn;
      },
      exit: (code) => {
        calls.exits.push(code);
      },
    },
    console: {
      error: (line) => {
        calls.logs.push(line);
      },
    },
    setInterval: (_fn, ms) => {
      assert.equal(ms, 2000);
      const timer = {};
      calls.timers.add(timer);
      return timer;
    },
    clearInterval: (timer) => {
      calls.timers.delete(timer);
    },
  });
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  return { calls, resolveTool, rejectTool, flush };
}

test("Actual render entrypoint cannot consume or mutate jobs before FFmpeg validation", async () => {
  const f = entrypoint();
  await f.flush();
  assert.equal(f.calls.options.autorun, false);
  assert.equal(f.calls.runs, 0);
  assert.equal(f.calls.databaseMutations, 0);
  assert.equal(f.calls.dispatchReads, 0);
  assert.equal(f.calls.timers.size, 0);
  f.resolveTool();
  await f.flush();
  assert.equal(f.calls.runs, 1);
  assert.equal(f.calls.databaseMutations, 1);
  assert.equal(f.calls.dispatchReads, 1);
  assert.equal(f.calls.timers.size, 1);
  await f.calls.events.SIGTERM();
  assert.equal(f.calls.timers.size, 0);
});
test("Actual render entrypoint leaves queued and stale jobs untouched after failed tool boot", async () => {
  const f = entrypoint();
  f.rejectTool(new Error("Media processing exceeded its time limit."));
  await f.flush();
  assert.equal(f.calls.runs, 0);
  assert.equal(f.calls.databaseMutations, 0);
  assert.equal(f.calls.dispatchReads, 0);
  assert.equal(f.calls.timers.size, 0);
  assert.deepEqual(f.calls.exits, [1]);
  assert.equal(JSON.parse(f.calls.logs[0]).event, "render.boot_failed");
});
test("Actual render entrypoint cannot start after shutdown during pending tool validation", async () => {
  const f = entrypoint();
  await f.calls.events.SIGTERM();
  f.resolveTool();
  await f.flush();
  assert.equal(f.calls.runs, 0);
  assert.equal(f.calls.databaseMutations, 0);
  assert.equal(f.calls.timers.size, 0);
  assert.deepEqual(f.calls.exits, [0]);
});
