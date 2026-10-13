import { evaluateYoutubeLiveReadiness } from "../packages/core/youtube-live-readiness";

const result = evaluateYoutubeLiveReadiness(process.env);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
