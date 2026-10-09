# EDITOR-01 device and platform readability acceptance

Status: **one bounded phone/app review completed; wider device/content acceptance pending**. Six user-provided screen recordings show the actual YouTube Shorts and Instagram Reels viewing interfaces. Automated export, decoded-frame and OCR results alone did not provide that evidence. `device-safe-v1` is a product placement choice, not an official platform certification.

## Captured app result (EDITOR-01AA)

| Placement | YouTube Shorts | Instagram Reels |
| --- | --- | --- |
| Standard 9:16 | Fail: lower long caption overlaps account/private/share UI. | Fail: opening title overlaps account/audio UI and lower long caption overlaps account/See more. |
| Extra margins 9:16 | No overlap in sampled playback. | No overlap in sampled playback. |
| Device safe 9:16 | No overlap in sampled playback. | No overlap in sampled playback. |

The uploaded clips were WhatsApp-transcoded at 386 × 850. The phone model, native capture dimensions and app versions are unknown. These results apply to the captured UI only. The raw account recordings and unredacted screenshots are not in the public-source checkpoint; `docs/qa/editor01aa-platform-review-evidence.json` stores only hashes, observed timestamps and account-free findings. The YouTube screen showed a Private label; the Instagram screens showed Your reels and insights, but their audience setting was not established. No account visibility was changed here.

New browser composer sessions start with Device safe selected at 9:16/720. Selecting the Reels / Shorts preset also selects Device safe when placement was explicitly changed to Standard. A previously chosen Extra margins/Device safe placement remains selected. Standard remains available after an explicit user choice, with an on-screen warning; saved render snapshots and backend defaults are unchanged. Review the export in its destination app. A second phone/layout, normal and long platform descriptions, real footage and wider language/font cases remain open.

## Prepare the exact review videos

```bash
TEST_DEVANAGARI_FONT_PATH=/path/to/NotoSansDevanagari-Regular.ttf npm run prepare:device-review
```

The command creates `.local/device-review/`: three 720 × 1280 H.264 videos (Standard, Extra margins, Device safe), nine 320-pixel frame samples, a synthetic high-detail background, and `manifest.json` with SHA-256 hashes and expected text. Each video contains short English, long English, and mixed Hindi scenes in that order. Captions should appear at approximately 0.5, 1.5, and 2.5 seconds. For real-content acceptance, set `MOS_DEVICE_REVIEW_IMAGE=/path/to/representative-image.png` to use licensed or user-provided visual content; it is stored only in `.local/` and its path is not written into the report. The script uses only local test assets and does not access provider accounts.

The initial synthetic fixture's three exact MP4s, three representative PNGs and hash manifest are saved under `docs/qa/editor01z-*`; see `docs/qa/editor01z-device-review-evidence.json`. A new run with a different background has different hashes and must have its own review receipt. Never use the synthetic receipt to claim acceptance for another video.

EDITOR-01AE strengthens the burned-text backdrop on new renders. Its independent
320px OCR gate uses the same pinned synthetic background SHA and eight exact
English title/caption crops for Extra margins and Device safe; see
`docs/qa/editor01ae-busy-readability-evidence.json`. The Z MP4 hashes identify
the older backdrop, so those already uploaded phone clips are still evidence
for their original bytes. New AE exports need a fresh phone/app review before
any broader platform readability claim.

## Review on real apps

Use the same hashed video for each placement. Check at least one small-screen phone and a second screen size/platform if available. In each target platform's current app, import into a draft or preview without public posting. Inspect **the viewing surface with its normal controls visible**, as well as the upload preview. Record a screenshot or screen recording at 0.5, 1.5, and 2.5 seconds; record app name/version, phone model, OS/version, screen size, aspect, video SHA-256, and whether the account name, description, action buttons, navigation, or captions cover text.

For every scene, record title and caption as **readable / covered / cropped / too small / low contrast**, with a screenshot and reviewer/date. Test normal and long descriptions if the platform provides that preview, because the visible UI can vary. Also compare the three placements. A failure requires a reproducible screenshot, a change to placement/rendering or content, a fresh export/hash, and a complete retest of the affected cases. Do not mark a platform accepted from an editor preview alone.

YouTube's Shorts visual guides explicitly warn that edge content can be hidden and viewer controls can overlap elements: https://support.google.com/youtube/answer/16215842 . TikTok's published safe-zone information is for ads and varies with format, caption length, and interactive additions: https://ads.tiktok.com/resources/help/article/tiktok-reservation-in-feed-ads-reach-frequency . Those sources inform the review; they do not certify organic posts or provide a universal percentage for this renderer.

The six uploaded app recordings establish the bounded result above. Broader phone/app/content acceptance remains **pending**. Keep this gate separate from EDITOR-01's other ASR/audio, live provider, full Compose, and cross-store restore work.
