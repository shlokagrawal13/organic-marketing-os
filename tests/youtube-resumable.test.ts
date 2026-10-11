import { test } from "node:test";
import assert from "node:assert/strict";
import { probeYoutubeUpload, sendYoutubeUploadBytes,
  startYoutubeUploadSession, verifiedYoutubeSessionUri } from "../packages/core/youtube-resumable";

const sessionUri = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=fixture-private";
const channelId = "UCfixture_channel_1234567890";
const metadata = { snippet: { title: "Reviewed fixture", description: "Synthetic only" },
  status: { privacyStatus: "private" as const, selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true } };

test("only the fixed videos.insert endpoint starts a validated session", async () => {
  let calls = 0;
  const response = await startYoutubeUploadSession({ accessToken: "fake-token", metadata,
    byteLength: 4, request: (async (url, init) => {
      calls++;
      assert.equal(String(url), "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status");
      assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "manual");
      return new Response(null, { status: 200, headers: { Location: sessionUri } });
    }) as typeof fetch });
  assert.equal(response.sessionUri, sessionUri);
  assert.equal(calls, 1);
  for (const uri of ["http://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=x",
    "https://evil.example/upload/youtube/v3/videos?uploadType=resumable&upload_id=x",
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable"])
    assert.throws(() => verifiedYoutubeSessionUri(uri));
});

test("status query sends no media and reads only a bounded 308 offset", async () => {
  const result = await probeYoutubeUpload({ accessToken: "fake-token", sessionUri,
    byteLength: 4, expectedChannelId: channelId,
    request: (async (_url, init) => {
      assert.equal(init?.method, "PUT"); assert.equal(init?.body, undefined);
      assert.equal((init?.headers as Record<string,string>)["Content-Range"], "bytes */4");
      return new Response(null, { status: 308, headers: { Range: "bytes=0-1" } });
    }) as typeof fetch });
  assert.deepEqual(result, { kind: "incomplete", committedBytes: 2 });
});

test("a completed receipt must carry an exact connected-channel video ID", async () => {
  const common = { accessToken: "fake-token", sessionUri, byteLength: 4, expectedChannelId: channelId };
  const complete = await probeYoutubeUpload({ ...common,
    request: (async () => Response.json({ id: "abcDEF01234", snippet: { channelId } },
      { status: 201 })) as typeof fetch });
  assert.deepEqual(complete, { kind: "complete", videoId: "abcDEF01234", channelId });
  await assert.rejects(() => probeYoutubeUpload({ ...common,
    request: (async () => Response.json({ id: "abcDEF01234", snippet: { channelId: "UCwrongchannel123" } },
      { status: 201 })) as typeof fetch }), /did not match/);
});

test("one media send never replays an ambiguous response or redirect", async () => {
  const common = { accessToken: "fake-token", sessionUri, byteLength: 4,
    expectedChannelId: channelId, body: new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.close(); },
    }) };
  let sends = 0;
  await assert.rejects(() => sendYoutubeUploadBytes({ ...common,
    request: (async (_url, init) => {
      sends++; assert.equal(init?.redirect, "manual");
      assert.equal((init?.headers as Record<string,string>)["Content-Range"], "bytes 0-3/4");
      throw new Error("Lost after remote receive");
    }) as typeof fetch }), /Lost/);
  assert.equal(sends, 1);
  await assert.rejects(() => sendYoutubeUploadBytes({ ...common,
    request: (async () => new Response(null, { status: 307 })) as typeof fetch }), /redirect/);
});
