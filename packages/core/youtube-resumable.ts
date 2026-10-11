// One explicit videos.insert resumable attempt. Never automatically retry an
// ambiguous provider response or interpret an expired session as no post.
export type YoutubeVideoMetadata = {
  snippet: { title: string; description: string };
  status: { privacyStatus: "private" | "unlisted" | "public";
    selfDeclaredMadeForKids: boolean; containsSyntheticMedia: boolean };
};
export type UploadProbe =
  | { kind: "complete"; videoId: string; channelId: string }
  | { kind: "incomplete"; committedBytes: number };

const endpoint = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
export function verifiedYoutubeSessionUri(value: string) {
  let uri: URL;
  try { uri = new URL(value); }
  catch { throw new Error("YouTube upload session URI is invalid."); }
  if (uri.protocol !== "https:" || uri.hostname !== "www.googleapis.com" ||
      uri.port || uri.username || uri.password || uri.hash ||
      uri.pathname !== "/upload/youtube/v3/videos" ||
      uri.searchParams.get("uploadType") !== "resumable" ||
      uri.searchParams.getAll("uploadType").length !== 1 ||
      !uri.searchParams.get("upload_id") ||
      uri.searchParams.getAll("upload_id").length !== 1)
    throw new Error("YouTube upload session URI is invalid.");
  return uri.toString();
}
function size(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("A positive video byte length is required.");
  return value;
}
function bearer(token: string) {
  if (!token || /[\r\n]/u.test(token))
    throw new Error("YouTube authorization is unavailable.");
  return `Bearer ${token}`;
}
function channel(id: string) {
  if (!/^UC[A-Za-z0-9_-]{10,}$/u.test(id))
    throw new Error("A connected YouTube channel ID is required.");
  return id;
}
function noRedirect(response: Response) {
  if (response.status >= 300 && response.status < 400 && response.status !== 308)
    throw new Error("YouTube upload returned an unexpected redirect.");
}
export async function startYoutubeUploadSession(input: {
  accessToken: string; metadata: YoutubeVideoMetadata; byteLength: number;
  request?: typeof fetch;
}) {
  const response = await (input.request ?? fetch)(endpoint, {
    method: "POST", redirect: "manual",
    headers: { Authorization: bearer(input.accessToken),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size(input.byteLength)),
      "X-Upload-Content-Type": "video/mp4" },
    body: JSON.stringify(input.metadata),
  });
  noRedirect(response);
  if (response.status !== 200)
    throw new Error("YouTube upload session was not confirmed.");
  const location = response.headers.get("location");
  if (!location) throw new Error("YouTube upload session URI is missing.");
  return { sessionUri: verifiedYoutubeSessionUri(location) };
}
async function parseUploadResponse(response: Response, expectedChannelId: string,
  length: number): Promise<UploadProbe> {
  noRedirect(response);
  if (response.status === 308) {
    const range = response.headers.get("range");
    if (!range) return { kind: "incomplete", committedBytes: 0 };
    const match = /^bytes=0-(\d+)$/u.exec(range);
    if (!match) throw new Error("YouTube returned an invalid upload range.");
    const committedBytes = Number(match[1]) + 1;
    if (!Number.isSafeInteger(committedBytes) || committedBytes <= 0 || committedBytes > length)
      throw new Error("YouTube returned an invalid upload range.");
    return { kind: "incomplete", committedBytes };
  }
  if (response.status !== 200 && response.status !== 201)
    throw new Error("YouTube upload outcome is not confirmed.");
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error("YouTube upload receipt is invalid."); }
  if (!value || typeof value !== "object")
    throw new Error("YouTube upload receipt is invalid.");
  const receipt = value as { id?: unknown; snippet?: { channelId?: unknown } };
  if (typeof receipt.id !== "string" || !/^[A-Za-z0-9_-]{11}$/u.test(receipt.id) ||
      receipt.snippet?.channelId !== expectedChannelId)
    throw new Error("YouTube upload receipt did not match the connected channel.");
  return { kind: "complete", videoId: receipt.id, channelId: expectedChannelId };
}
// Empty PUT is status-only. 308 is progress, never proof that no post exists.
export async function probeYoutubeUpload(input: {
  accessToken: string; sessionUri: string; byteLength: number;
  expectedChannelId: string; request?: typeof fetch;
}): Promise<UploadProbe> {
  const length = size(input.byteLength), expectedChannelId = channel(input.expectedChannelId);
  const response = await (input.request ?? fetch)(verifiedYoutubeSessionUri(input.sessionUri), {
    method: "PUT", redirect: "manual",
    headers: { Authorization: bearer(input.accessToken), "Content-Length": "0",
      "Content-Range": `bytes */${length}` },
  });
  return parseUploadResponse(response, expectedChannelId, length);
}
// Exactly one media request. The caller marks a lost response UNKNOWN.
export async function sendYoutubeUploadBytes(input: {
  accessToken: string; sessionUri: string; byteLength: number;
  expectedChannelId: string; body: ReadableStream<Uint8Array>;
  request?: typeof fetch;
}): Promise<UploadProbe> {
  const length = size(input.byteLength), expectedChannelId = channel(input.expectedChannelId);
  const response = await (input.request ?? fetch)(verifiedYoutubeSessionUri(input.sessionUri), {
    method: "PUT", redirect: "manual",
    headers: { Authorization: bearer(input.accessToken), "Content-Type": "video/mp4",
      "Content-Length": String(length), "Content-Range": `bytes 0-${length - 1}/${length}` },
    body: input.body, duplex: "half",
  } as RequestInit & { duplex: "half" });
  return parseUploadResponse(response, expectedChannelId, length);
}
