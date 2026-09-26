if (process.env.MOS_ISOLATED_TEST_HARNESS !== "true") {
  throw new Error(
    "Integration tests must run through scripts/verify-local.mjs using isolated test services. Never run against a real workspace.",
  );
}
