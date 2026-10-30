# FlowBack R4 — storyboard

Two deliverables cut from one system: warm paper, graphite, signal green, one orange accent.
No stock footage, no commercial music, no generated logo lettering.

## Main film — FlowBack — From Noise to Action

| Time | Beat | Picture | Real material / type | Sound |
|---|---|---|---|---|
| 00:00.0–00:00.6 | COLD OPEN | Three fragments already on screen: `收到` (orange), `周五?` (ink), `改周四` (green), a black rule. No blank first frame. | Huashu HTML type, Noto Sans SC 900 | glitch + type bed |
| 00:00.6–00:03.8 | NOISE | 12 hard-cut layouts. Chat fragments collide, clip at the edges, invert between paper and graphite. `NOISE` outline lands at 2.38; all fragments collapse at 2.86. | 42 fragments from the real conversation vocabulary; `NOISE` kinetic overlay | 112 BPM pulse, type ticks |
| 00:03.8–00:04.1 | CUT | Black/paper wipe; the phone is already entering. | Huashu transition | impact 4.12 |
| 00:04.1–00:12.0 | IMPORT | Real H5 import page in a phone frame: user-selected screenshot, preview, start button, DeepSeek loading. Left copy: “A conversation ends here.” | `assets/video/import.mp4`, 750×1624, real H5/Dev session | music opens, phone whoosh |
| 00:12.0–00:23.5 | STRUCTURE | Real review page stays on screen. Programmatic task rows appear at left: task / owner / due / source. Review clip covers the actual AI-draft data. | `assets/video/review.mp4` + live HTML rows | thuds and ticks at 13.15 |
| 00:23.5–00:32.0 | FRICTION | Graphite field. `TIME CONFLICT.` in orange. Tags: DUE CONFLICT / OWNER GAP / SOURCE ATTACHED. The actual edit sheet opens in the phone; the source quote is pulled out at 26.0; the human correction appears at 29.0: `陈默 · 11月2日前`. | `review.mp4` media offset 3.55, real edit; quote from project source | impact 23.55, stamp 26.0, draw 29.3 |
| 00:32.0–00:40.0 | ACTION | Real task list returns. Phone shows 0/3 then 1/3; the first task is checked. Left side counts `1/3` and lists the real three tasks. `STATE PERSISTED` / SQLite. | `assets/video/tasks.mp4`, real completion | tick 35.0, ding 35.6 |
| 00:40.0–00:45.0 | LOCKUP | `FlowBack` / `回响` / `FROM NOISE TO ACTION`. The last 3.1 s are a still end card. | programmatic type, official Latin/CJK names | chime + subdrop 40.1 |

Stable end: 41.9–45.0 (3.1 s). The end card is the only hold longer than 2 s.

## Typography film — CHAOS → ORDER

| Time | Beat | Picture | Type / code | Sound |
|---|---|---|---|---|
| 00:00–00:04.5 | CHAOS | 12 cuts at 0.38 s. Fragments are oversized, clipped, inverted; `？` and `...` are actors, not decoration. | RuiC Canvas `text`/`text_slices`, Noto Sans SC 900 + Archivo Black | 128 BPM kick/hats, broken |
| 00:04.5–00:05.0 | CHAOS title | Graphite field; `CHAOS` outline/solid; “没有结构，只有回声。” | RuiC `text_outline`/`text` | impact |
| 00:05.0–00:09.55 | ORDER | Paper grid, `ORDER` settles from 350→206 px. Four slots slide in on a 4-column grid: TASK / OWNER / DUE / SOURCE. Owner is marked in signal green. | RuiC `Canvas.rect`/`text`; `fit_size` for display | pulse, ticks |
| 00:09.55–00:10.0 | INVERSION | Grid becomes graphite; `ORDER` green; “不是整理，是决定。” | RuiC type | riser/impact |
| 00:10.0–00:13.0 | ACTION | Hard cuts between graphite, signal green and paper. `ACTION` is cropped intentionally; micro labels `NO SILENT WRITES.` / `HUMAN CHECK.` | RuiC `text`/`text_slices` | full four-on-floor; impacts |
| 00:13.0–00:15.0 | LOCKUP | White field. `FlowBack`, `回响`, `FROM NOISE TO ACTION`; lime rule. No generated lettering. | RuiC `Canvas.text` with Archivo Black + Noto Sans SC 900 | chime / button |

Stable end: 13.7–15.0 (1.3 s), with the exact brand lockup.

## Provenance

- H5 footage was recorded on 2026-10-30 at 375×812 / 2× from the accepted Taro H5 preview. It is **H5 preview**, not WeChat-native device footage.
- The project used for the capture was a temporary dev identity; it was deleted after recording. The seven pre-existing projects remain.
- Real DeepSeek is called by the server during the captured flow; no synthetic AI result was inserted.
- No MiniMax H3 video asset existed locally at production time; nothing H3-based was used or invented.
