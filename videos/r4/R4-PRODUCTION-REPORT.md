# FlowBack｜R4 Motion Film Production Report

**Delivered:** 2026-10-30  
**Scope:** two finished MP4 films, editable source, storyboard, keyframes. No FlowBack product-code or database changes.  
**Claim boundary:** the product footage is the real **Taro H5 preview**; it is not WeChat-native device footage. R3’s WeChat real-device status remains PENDING.

## 1. Deliverables

| File | Duration | Picture | Sound | Size |
|---|---:|---|---|---:|
| `FlowBack_Demo_45s.mp4` | 45.000 s | 1920×1080, 30 fps, H.264 High | AAC LC, 48 kHz, stereo | 9,952,824 B |
| `FlowBack_Typography_15s.mp4` | 15.000 s | 1920×1080, 30 fps, H.264 High | AAC LC, 48 kHz, stereo | 32,475,988 B |

Also delivered:

- `storyboard/storyboard.md` — shot-by-shot timing, copy, source, sound.
- `storyboard/main-contact-sheet.jpg` — 1 fps overview of the 45 s film.
- `storyboard/typography-contact-sheet.jpg` — 1 fps overview of the 15 s film.
- `keyframes/demo/` — 12 checked frames at 0, 0.8, 1.6, 2.5, 5, 13, 21, 26.2, 29.2, 36, 40.5, 44.5 s.
- `keyframes/typography/` — 9 checked frames at 0.2, 2.0, 4.7, 5.8, 7.9, 10.2, 11.0, 12.8, 14.8 s.
- `source/` — Huashu project, RuiC project, H5 capture script and clips, materials list.

Hashes:

```text
SHA-256 FlowBack_Demo_45s.mp4       a59cc36bbd5cd9414b7c824e86992beeaf77c52159ac35ea74f6e9e82ef6a9cc
SHA-256 FlowBack_Typography_15s.mp4 dfdd5768130d007108b89c6fbcb86418236b226599088c178dcc440381fc5791
```

## 2. Motion tools — what was actually used

### Huashu Motion — primary edit / render

Repo: `https://github.com/alchaincyf/huashu-motion`  
Version: `0.3.1` · commit `52467f9` · **MIT**. Chromium/GSAP runtime; bundled fonts are OFL. GSAP’s own licence is in `vendor/GSAP-LICENSE.txt`.

Actually used:

- `cli/om.js` — `om new`, `om still`, `om check`, `om sound`, `om render`.
- `cli/lib/capture.js` and `cli/lib/render.js` — Chrome frame-by-frame capture, parallel workers, footage extraction, H.264/AAC encode.
- `runtime/om.js` — `OM.music`, `OM.sfx`, `OM.spring`, `OM.beat`; the 112 BPM pulse score and 15 gesture hits.
- `runtime/om-engine.js` — `<video data-start data-duration data-media-start data-playback-rate>` seek/extract path; this is how the real H5 clips are sampled frame-accurately.
- `templates/blank/index.html` — the single-composition + paused-GSAP-timeline contract used as the starting point.

Actual effects in the 45 s film:

1. A **cold open already in motion** (no blank first frame): `收到` / `周五?` / `改周四`.
2. Twelve hard-cut chat layouts with a drifting container and large cut words.
3. Graphite wipe into the real phone; phone rises/scales, then drifts continuously.
4. Real H5 clips inside a CSS phone frame, with a slow screen scanline and a continuous progress rule.
5. Programmatic task rows that align with the real review UI.
6. Dark friction chapter, orange conflict type, real review sheet, quote extraction, human correction.
7. Real task list with a 0→1/3 completion state, then a 3.1 s stable end lockup.

Environment fix (tooling only): Huashu’s `cli/lib/cdp.js` was locally given `--no-sandbox` and `--disable-crashpad` so Chrome could run under the DSH file sandbox. `HOME` is set to a workspace `.chrome-home`; FFmpeg is the workspace binary. These changes are not in FlowBack product code.

### RuiC Motion — programmatic typography and audio

Repo: `https://github.com/HRuiCcc/RuiC-motion-reel`  
Commit: `89213c3` · **MIT**; bundled fonts are SIL OFL 1.1.

Scaffold: `scripts/new_reel.py --style none` → `source/ruic-type/` with a private copy of the engine as `mg/`.

Actually used:

- `mg/core.py` — `Canvas(1920,1080,ss=1.5)`, `Painter.text`, `Painter.text_slices` (glitch bands), `Painter.text_outline`, `Canvas.rect/line`, `Canvas.grain/vignette/tonemap`.
- `mg/fonts.py` — `fit_size`, `display`, `ui`, `mono`.
- `ruic_type/build.py` — the 450-frame timeline, 12 chaos cuts, grid/order layout, ACTION cuts, exact lockup.
- `ruic_type/audio.py` — copied from RuiC `template/audio.py`; original synth voices: kick, clap, hat, sub, FM pluck, pad, riser, impact; 128 BPM, 8 bars = 15.000 s.
- Fonts: Archivo Black (Latin display), **Noto Sans SC 900/500** (Chinese). The Noto faces come from Huashu Motion and are OFL 1.1.

Actual effects in CHAOS → ORDER:

- 12 typographic cuts at 0.38 s; sliced/offset bands; oversized clipped text.
- A structured 4-column grid: TASK / OWNER / DUE / SOURCE; green owner marker.
- 350→206 px `ORDER` settle; a second large `ORDER` decision line.
- 10–13 s high-contrast black / signal-green / paper `ACTION` cuts, with sliced glyphs.
- A white exact lockup: `FlowBack` / `回响` / `FROM NOISE TO ACTION`.

A real engine bug was caught during review: the bundled Inter face renders a fullwidth `？` as a literal green **NO SIGNAL** placard. The renderer now routes any non-ASCII/punctuation string to Noto Sans SC; the bug is gone from the delivered frames.

### Huashu Art Motion — narrative grammar, not a second renderer

Repo: `https://github.com/alchaincyf/huashu-art-motion`  
Commit: `8a0d7d7` · **MIT**.

Read and applied:

- `skills/huashu-art-motion/references/动画语法/y5_kinetic_type.md` — one focus per beat; 3.4 : 1 : 0.4 type hierarchy; main word “slam”, support from a slot, marker/highlighter, camera bump, color chapter, reveal-on-beat.
- `scripts/engine/lib/typo.js` — `TY.slam`, `TY.rise`, `TY.marker` as the reference implementation of those motions.
- `scripts/engine/clips/y5_kinetic_type.js` — one clip per cue, beat-numbered entries, progress rail and giant background number.

These rules drive the cold open, the cut-word rhythm, the task-row rise and the green owner marker. Art Motion’s runtime was not used because the main film’s renderer is Huashu and the type film’s renderer is RuiC; the report does not claim an Art Motion render.

## 3. Material provenance

- H5 capture: `source/h5-capture/record.mjs`, Puppeteer 23 / CDP screencast, viewport 375×812, DPR 2, 25.2 s raw, 750×1624 elementary stream.
- Real H5 pages: `/pages/import/index`, `/pages/review/index`, `/pages/tasks/index`.
- Input screenshot: `acceptance/images/07-chat-conflict.png`.
- Server: real DeepSeek call through FlowBack’s `/api/analyze`; no fake AI output was inserted.
- The capture used a temporary dev identity. The project and its upload were deleted after recording; the database still has the **seven pre-R4 projects** (23 task rows).
- Product verification after R4: `npm run check` passed, **11 test files / 78 tests**, with the pre-existing projects and task rows intact. No FlowBack business code or schema was changed.
- H5 labels in the film: `REAL H5 FLOW / DEV SESSION`. No frame is labelled as a WeChat-native device capture.
- No MiniMax H3 video asset existed locally at production time; nothing H3-generated was used or invented.

## 4. Verification

### FFprobe

```text
FlowBack_Demo_45s.mp4
  h264 / High / 1920×1080 / 30 fps / AAC LC 48 kHz stereo / 45.000 s

FlowBack_Typography_15s.mp4
  h264 / High / 1920×1080 / 30 fps / AAC LC 48 kHz stereo / 15.000 s
```

### Huashu `om check`

Final composition: **0 errors**, 9 warnings (small-label contrast, three width-animated hairlines). No structural/build error. `om check` verified frame determinism across repeated seeks.

### Huashu `om qa` (main)

- No blank first frame; the cold open is filled at 0.0.
- 7 intentional hard cuts (3.37, 3.40, 3.43, 3.60, 39.93, 39.97, 40.00).
- Reading holds are reported around the real H5 screens (5.4–7.4, 8.3–11.5, 12.8–21.5, etc.). These are deliberate holds on real UI, not hidden frozen frames; no fake motion was painted over the product screen.
- No single-frame pops. The opening uses cut-word accents (not one-frame flashes).

### Audio

```text
Main:       -14.2 LUFS integrated, true peak -1.3 dBFS (generated by om sound)
Typography: -13.7 LUFS integrated, true peak -3.0 dBFS (mastered to 48 kHz)
```

No commercial recordings. Huashu generated its score and 15 effects from the timeline; RuiC’s synth arrangement is code.

### Keyframe inspection

Checked 21 full-resolution frames, plus both 1 fps contact sheets:

- No text is cut off at the frame edge except deliberate clipped chaos words.
- Chinese brand text `回响` is set programmatically in Noto Sans SC 900; Latin `FlowBack` in Archivo Black.
- H5 UI remains legible; no overlay covers the primary action/feedback.
- The main end card is stable for **3.1 s** (41.9–45.0); typography end settles at 13.7 and holds to 15.0.

## 5. Remaining limitations

- **Not WeChat-native.** No AppID, trusted HTTPS request domain or WeChat DevTools real-device run was used. R3’s real-device gate remains PENDING.
- The H5 clips are real in the browser, but the phone frame, kinetic type and cards are composited motion graphics. This is stated on screen.
- MiniMax H3: no local asset, no test insert.
- The 45 s film contains reading holds over the real review/task screens; QA flags these as holds, not as dead black frames.

## 6. Reproduce

```bash
cd <WORKSPACE>/flowback

# Main film — Huashu Motion
export PATH="<WORKSPACE>/tools/ffmpeg-bin:$PATH"
export HOME="$PWD/.chrome-home"
OM=<WORKSPACE>/tools/motion/huashu-motion/cli/om.js
node "$OM" sound videos/r4/source/flowback-film
node "$OM" render videos/r4/source/flowback-film --workers 4

# Typography film — RuiC Motion
cd videos/r4/source/ruic-type
PYTHONPATH="$PWD/.pydeps:$PWD" \
  python3 -m ruic_type.build --workers 4
```

Install numpy for the system Python 3.9 with `python3 -m pip install --target .pydeps numpy`; the platform-specific production dependency folder is intentionally not committed. Pillow 11.3 is required. FFmpeg 9.0.2 is the workspace binary.
