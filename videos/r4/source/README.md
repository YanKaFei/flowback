# R4 source

This folder is the editable source, not a render dump.

## `flowback-film/`

Huashu Motion 0.3.1 project (MIT). A single `index.html` composition with GSAP and the Huashu runtime. The phone video is the real H5 capture; the surrounding type, cards and end lockup are HTML/CSS/GSAP.

```bash
export PATH="<WORKSPACE>/tools/ffmpeg-bin:$PATH"
export HOME="$PWD/.chrome-home"   # keep Chrome's crashpad inside the workspace
OM=<WORKSPACE>/tools/motion/huashu-motion/cli/om.js
node "$OM" still videos/r4/source/flowback-film --at 0,5,13,21,26,36,44
node "$OM" sound videos/r4/source/flowback-film
node "$OM" render videos/r4/source/flowback-film --workers 4
```

`assets/sound.wav` is generated from `OM.music({style:'pulse', bpm:112})` + `OM.sfx` hits. `materials.md` is the asset provenance list.

## `ruic-type/`

RuiC Motion engine (MIT) copied into `mg/`; the film is `ruic_type/build.py` and uses:

- `mg.core.Canvas` / `Painter.text` / `Painter.text_slices` / `Painter.text_outline`
- `mg.fonts.fit_size`, `display`, `ui`, `mono`
- `mg.dsp` + the RuiC `template/audio.py` voice set and 128 BPM arrangement
- bundled Noto Sans SC 900/500 (OFL 1.1, from Huashu Motion) for Chinese

```bash
PYTHONPATH="<WORKSPACE>/flowback/videos/r4/source/pydeps:$PWD" \
  python3 -m ruic_type.build --at 0.2,5.8,10.2,13.2,14.8
PYTHONPATH="<WORKSPACE>/flowback/videos/r4/source/pydeps:$PWD" \
  python3 -m ruic_type.build --audio-only
PYTHONPATH="<WORKSPACE>/flowback/videos/r4/source/pydeps:$PWD" \
  python3 -m ruic_type.build --workers 4
```

Install numpy for the system Python 3.9 (the local `pydeps` used during production is intentionally not committed):

```bash
python3 -m pip install --target .pydeps numpy
```

`Pillow` 11.3.0 is required. The production render used numpy 2.0.2.

## `h5-capture/`

- `record.mjs`: Puppeteer 23 / CDP screen capture; viewport 375×812, DPR 2.
- `recording.json`: exact action/scene timestamps and frame timestamps.
- `h5-flow.mp4`: 25.2 s, 750×1624, 30 fps, no audio.
- `import.mp4`, `review.mp4`, `tasks.mp4`: the three cuts used in the main film.

The capture used a temporary dev identity. The project was deleted after capture to keep the product database at its pre-R4 state.
