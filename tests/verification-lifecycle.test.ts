import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
const moduleUrl = new URL(
  "../scripts/verification-lifecycle.mjs",
  import.meta.url,
).href;
const wait =
  "await new Promise(resolve => AbortSignal.timeout(40).addEventListener('abort',resolve,{once:true}));";
function child(code) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    encoding: "utf8",
    timeout: 10000,
  });
}
test("Verification lifecycle prevents actual unsettled top-level await exit and releases on success", () => {
  const without = child(wait);
  assert.equal(without.status, 13);
  const withLifecycle = child(
    "import {keepVerificationAlive} from " +
      JSON.stringify(moduleUrl) +
      ";const release=keepVerificationAlive();try{" +
      wait +
      'console.log("completed")}finally{release()}',
  );
  assert.equal(withLifecycle.status, 0, withLifecycle.stderr);
  assert.equal(withLifecycle.stdout.trim(), "completed");
  assert.equal(withLifecycle.signal, null);
});
test("Verification lifecycle releases after bounded asynchronous failure so cleanup does not hang", () => {
  const result = child(
    "import {keepVerificationAlive} from " +
      JSON.stringify(moduleUrl) +
      ";const release=keepVerificationAlive();try{" +
      wait +
      'throw Error("fixture failure")}catch{process.exitCode=1}finally{release();console.log("cleaned")}',
  );
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stdout.trim(), "cleaned");
});
