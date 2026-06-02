"""HTML/Canvas player for frame-by-frame foot pressure replay."""

from __future__ import annotations

import json

from core.domain.foot_replay import ReplaySequence
from core.domain.sensor_mapping import FOOT_LABELS, FOOT_ORDER, LEFT, RIGHT
from core.domain.visualization import (
    CARD_CANVAS_HEIGHT,
    FOOT_MASK_PATHS,
    FOOT_TEMPLATE_PATHS,
    SENSOR_LAYOUTS,
    _asset_data_uri,
)

REPLAY_CANVAS_WIDTH = 980
REPLAY_TIMELINE_HEIGHT = 110
REPLAY_CONTROLS_HEIGHT = 92
REPLAY_COMPONENT_HEIGHT = 1120

# Sensor layout numbers with live FSR values: heel, lateral forefoot, medial forefoot.
_VALUE_INDEX_BY_LAYOUT_NUMBER = {1: 0, 4: 1, 5: 2}


def build_replay_canvas_html(
    replay: ReplaySequence,
    *,
    frame_start: int = 0,
    frame_end: int | None = None,
    selected_step: dict | None = None,
    show_labels: bool = False,
    initial_speed: float = 1.0,
    initial_norm: str = "session",
) -> str:
    """Build a self-contained replay player for Streamlit ``components.html``."""
    end_index = frame_end if frame_end is not None else max(len(replay.frames) - 1, 0)
    start_index = max(0, min(frame_start, end_index))

    asset_uris = {
        foot: {
            "templateSrc": _asset_data_uri(FOOT_TEMPLATE_PATHS[foot], "image/png"),
            "maskSrc": _asset_data_uri(FOOT_MASK_PATHS[foot], "image/png"),
        }
        for foot in FOOT_ORDER
    }

    layouts = {
        LEFT: [_layout_entry(entry) for entry in SENSOR_LAYOUTS[LEFT]],
        RIGHT: [_layout_entry(entry) for entry in SENSOR_LAYOUTS[RIGHT]],
    }

    state = {
        "assets": asset_uris,
        "layouts": layouts,
        "footLabels": {LEFT: FOOT_LABELS[LEFT], RIGHT: FOOT_LABELS[RIGHT]},
        "frames": replay.frames,
        "steps": replay.steps,
        "timelineLeft": replay.timeline_left,
        "timelineRight": replay.timeline_right,
        "sessionMax": replay.session_max,
        "stepMax": {str(k): v for k, v in replay.step_max_by_id.items()},
        "threshold": replay.sensor_threshold,
        "frameStart": start_index,
        "frameEnd": end_index,
        "selectedStep": selected_step,
        "showLabels": show_labels,
        "initialSpeed": initial_speed,
        "initialNorm": initial_norm,
        "valueIndexByNumber": _VALUE_INDEX_BY_LAYOUT_NUMBER,
    }
    state_json = json.dumps(state, ensure_ascii=False)

    return f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {{
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: transparent; color: #0f172a; }}
    .replay-root {{
      width: 100%;
      max-width: {REPLAY_CANVAS_WIDTH}px;
      margin: 0 auto;
      padding: 4px 10px 0;
    }}
    .replay-title {{
      margin: 0 0 8px;
      text-align: center;
      font-size: clamp(22px, 3.5vw, 30px);
      font-weight: 850;
      letter-spacing: -0.01em;
    }}
    .replay-step-info {{
      margin: 0 0 10px;
      padding: 10px 14px;
      border: 1px solid #dbeafe;
      border-radius: 14px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 14px;
      font-weight: 650;
      line-height: 1.45;
    }}
    .replay-timeline {{
      margin-bottom: 12px;
      border: 1px solid #e8edf5;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
      padding: 10px 14px 8px;
    }}
    .replay-timeline__title {{
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 800;
      color: #334155;
    }}
    .replay-timeline canvas {{
      display: block;
      width: 100%;
      height: {REPLAY_TIMELINE_HEIGHT}px;
      cursor: pointer;
    }}
    .replay-timeline__legend {{
      display: flex;
      gap: 16px;
      margin-top: 4px;
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
    }}
    .replay-timeline__legend span::before {{
      content: "";
      display: inline-block;
      width: 12px;
      height: 3px;
      margin-right: 6px;
      vertical-align: middle;
      border-radius: 999px;
    }}
    .replay-timeline__legend .left::before {{ background: #2563eb; }}
    .replay-timeline__legend .right::before {{ background: #ea580c; }}
    .replay-controls {{
      display: grid;
      grid-template-columns: auto auto 1fr auto;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
      padding: 10px 12px;
      border: 1px solid #e8edf5;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
    }}
    .replay-controls button {{
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 14px;
      font-weight: 750;
      padding: 8px 14px;
      cursor: pointer;
    }}
    .replay-controls button#replay-play {{
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
      min-width: 88px;
    }}
    .replay-controls button.active {{
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }}
    .replay-controls__speeds {{
      display: flex;
      gap: 6px;
    }}
    .replay-controls__slider {{
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }}
    .replay-controls__slider input[type="range"] {{
      width: 100%;
    }}
    .replay-controls__time {{
      text-align: right;
      font-size: 14px;
      font-weight: 800;
      color: #334155;
      white-space: nowrap;
    }}
    .replay-controls__norm {{
      grid-column: 1 / -1;
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
    }}
    .replay-cards {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
    }}
    .replay-card {{
      border: 1px solid #e8edf5;
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }}
    .replay-card__header {{
      display: flex;
      justify-content: space-between;
      padding: 14px 20px 0;
      font-weight: 850;
      font-size: clamp(20px, 2.8vw, 26px);
    }}
    .replay-card__total {{
      color: #64748b;
      font-size: 15px;
      font-weight: 750;
    }}
    .replay-card canvas {{
      display: block;
      width: 100%;
      height: min(62vw, {CARD_CANVAS_HEIGHT}px);
      max-height: {CARD_CANVAS_HEIGHT}px;
    }}
    @media (max-width: 720px) {{
      .replay-cards {{ grid-template-columns: 1fr; }}
      .replay-controls {{ grid-template-columns: 1fr 1fr; }}
      .replay-controls__time {{ grid-column: 1 / -1; text-align: left; }}
    }}
  </style>
</head>
<body>
  <div id="replay-root" class="replay-root" aria-label="Druck-Replay">Replay wird geladen ...</div>
  <script>
    const DATA = {state_json};
    const FOOT_KEYS = ["left", "right"];
    const FOOT_DATA_KEYS = ["L", "R"];

    let currentIdx = DATA.frameStart;
    let playing = false;
    let speed = DATA.initialSpeed || 1;
    let normMode = DATA.initialNorm || "session";
    let rafId = null;
    let playAnchor = null;

    function clamp(v, min, max) {{
      return Math.min(max, Math.max(min, v));
    }}

    function pressureColor(intensity) {{
      const stops = [
        [0.00, [0, 70, 255]],
        [0.25, [0, 200, 255]],
        [0.48, [0, 220, 70]],
        [0.70, [255, 232, 0]],
        [0.85, [255, 138, 0]],
        [1.00, [255, 16, 16]],
      ];
      const t = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
      for (let i = 1; i < stops.length; i += 1) {{
        const [pos, rgb] = stops[i];
        const [prevPos, prevRgb] = stops[i - 1];
        if (t <= pos) {{
          const localT = (t - prevPos) / (pos - prevPos);
          const mixed = rgb.map((ch, idx) =>
            Math.round(prevRgb[idx] + (ch - prevRgb[idx]) * localT)
          );
          return `rgb(${{mixed[0]}}, ${{mixed[1]}}, ${{mixed[2]}})`;
        }}
      }}
      return "rgb(255, 31, 31)";
    }}

    function rgba(rgb, alpha) {{
      return rgb.replace("rgb", "rgba").replace(")", `, ${{alpha}})`);
    }}

    function loadImage(src) {{
      return new Promise((resolve, reject) => {{
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }});
    }}

    function drawEllipticalGradient(ctx, x, y, radiusX, radiusY, rotation, color, alpha) {{
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, rgba(color, Math.min(alpha, 1)));
      gradient.addColorStop(0.4, rgba(color, alpha * 0.82));
      gradient.addColorStop(0.72, rgba(color, alpha * 0.38));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(radiusX, radiusY);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }}

    function stepForFrame(idx) {{
      return DATA.steps.find((step) => idx >= step.startIdx && idx <= step.endIdx) || null;
    }}

    function maxPressureForFrame(idx) {{
      if (normMode === "session") return DATA.sessionMax > 0 ? DATA.sessionMax : 1;
      const step = DATA.selectedStep || stepForFrame(idx);
      if (step && DATA.stepMax[String(step.id)]) {{
        return DATA.stepMax[String(step.id)];
      }}
      return DATA.sessionMax > 0 ? DATA.sessionMax : 1;
    }}

    function frameAt(idx) {{
      return DATA.frames[clamp(idx, DATA.frameStart, DATA.frameEnd)];
    }}

    function drawFoot(canvas, footKey, template, mask, values, maxPressure) {{
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);
      if (width <= 0 || height <= 0) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.drawImage(template, 0, 0, width, height);
      ctx.restore();

      const layout = DATA.layouts[footKey];
      const heatmap = document.createElement("canvas");
      heatmap.width = width;
      heatmap.height = height;
      const heatCtx = heatmap.getContext("2d");
      const threshold = DATA.threshold || 0;

      layout.forEach((sensor) => {{
        const valueIndex = DATA.valueIndexByNumber[String(sensor.number)];
        if (valueIndex === undefined) return;
        const value = values[valueIndex] || 0;
        if (value <= threshold) return;

        const intensity = clamp(value / maxPressure, 0, 1);
        const x = (sensor.x / 100) * width;
        const y = (sensor.y / 100) * height;
        const spread = (0.82 + 0.18 * intensity) * sensor.maxSpread;
        const radiusX = (sensor.radiusX / 100) * width * spread;
        const radiusY = (sensor.radiusY / 100) * height * spread;
        const color = pressureColor(intensity);
        const alpha = 0.82 + 0.16 * intensity;
        drawEllipticalGradient(heatCtx, x, y, radiusX, radiusY, sensor.rotation, color, alpha);
      }});

      heatCtx.globalCompositeOperation = "destination-in";
      heatCtx.drawImage(mask, 0, 0, width, height);
      ctx.drawImage(heatmap, 0, 0);

      if (DATA.showLabels) {{
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${{12 * scale}}px Inter, system-ui, sans-serif`;
        layout.forEach((sensor) => {{
          const valueIndex = DATA.valueIndexByNumber[String(sensor.number)];
          if (valueIndex === undefined) return;
          const value = values[valueIndex] || 0;
          if (value <= threshold) return;
          const x = (sensor.x / 100) * width;
          const y = (sensor.y / 100) * height;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.strokeStyle = "rgba(148,163,184,0.5)";
          ctx.lineWidth = scale;
          const label = `${{sensor.label}}\\n${{value.toFixed(0)}} raw`;
          const lines = label.split("\\n");
          const boxW = 120 * scale;
          const boxH = 36 * scale;
          const boxX = clamp(x - boxW / 2, 8, width - boxW - 8);
          const boxY = clamp(y - boxH / 2, 8, height - boxH - 8);
          roundRect(ctx, boxX, boxY, boxW, boxH, 8 * scale);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#0f172a";
          lines.forEach((line, i) => {{
            ctx.fillText(line, boxX + boxW / 2, boxY + boxH / 2 + (i - 0.5) * 14 * scale);
          }});
        }});
        ctx.restore();
      }}
    }}

    function roundRect(ctx, x, y, w, h, r) {{
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }}

    function drawTimeline(canvas) {{
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);
      if (width <= 0 || height <= 0) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);

      const start = DATA.frameStart;
      const end = DATA.frameEnd;
      const span = Math.max(end - start, 1);
      const leftSeries = DATA.timelineLeft;
      const rightSeries = DATA.timelineRight;
      const maxSum = Math.max(
        ...leftSeries.slice(start, end + 1),
        ...rightSeries.slice(start, end + 1),
        1
      );

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      DATA.steps.forEach((step) => {{
        if (step.endIdx < start || step.startIdx > end) return;
        const x0 = ((Math.max(step.startIdx, start) - start) / span) * width;
        const x1 = ((Math.min(step.endIdx, end) - start) / span) * width;
        ctx.fillStyle = step.foot === "L" ? "rgba(37,99,235,0.08)" : "rgba(234,88,12,0.08)";
        ctx.fillRect(x0, 0, x1 - x0, height);
      }});

      function drawSeries(series, color) {{
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        for (let i = start; i <= end; i += 1) {{
          const x = ((i - start) / span) * width;
          const y = height - (series[i] / maxSum) * (height * 0.82) - height * 0.08;
          if (i === start) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }}
        ctx.stroke();
      }}

      drawSeries(leftSeries, "#2563eb");
      drawSeries(rightSeries, "#ea580c");

      const playX = ((currentIdx - start) / span) * width;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();
    }}

    function updateUi(root, assetsByFoot) {{
      const frame = frameAt(currentIdx);
      const maxPressure = maxPressureForFrame(currentIdx);
      const leftTotal = (frame.L || []).reduce((a, b) => a + b, 0);
      const rightTotal = (frame.R || []).reduce((a, b) => a + b, 0);

      root.querySelector("#replay-time").textContent =
        `${{frame.t.toFixed(2)}} s · Frame ${{currentIdx + 1}}/${{DATA.frameEnd + 1}}`;
      root.querySelector("#replay-play").textContent = playing ? "⏸ Pause" : "▶ Play";
      root.querySelector("#replay-slider").value = String(currentIdx);

      FOOT_KEYS.forEach((footKey, index) => {{
        const values = frame[FOOT_DATA_KEYS[index]] || [0, 0, 0];
        const totalEl = root.querySelector(`[data-total="${{footKey}}"]`);
        if (totalEl) totalEl.textContent = `${{values.reduce((a, b) => a + b, 0).toFixed(0)}} raw`;
        const canvas = root.querySelector(`canvas[data-foot="${{footKey}}"]`);
        const assets = assetsByFoot[footKey];
        drawFoot(canvas, footKey, assets.template, assets.mask, values, maxPressure);
      }});

      const timeline = root.querySelector("#replay-timeline-canvas");
      if (timeline) drawTimeline(timeline);
    }}

    function seekTo(idx, root, assetsByFoot) {{
      currentIdx = clamp(idx, DATA.frameStart, DATA.frameEnd);
      updateUi(root, assetsByFoot);
    }}

    function stopPlayback() {{
      playing = false;
      playAnchor = null;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }}

    function playLoop(root, assetsByFoot) {{
      if (!playing) return;
      const now = performance.now();
      if (!playAnchor) playAnchor = {{ idx: currentIdx, time: now }};

      while (currentIdx < DATA.frameEnd) {{
        const nextFrame = frameAt(currentIdx + 1);
        const currentFrame = frameAt(currentIdx);
        const dt = Math.max((nextFrame.t - currentFrame.t) * 1000 / speed, 16);
        const elapsed = now - playAnchor.time;
        const expectedIdx = playAnchor.idx + Math.floor(elapsed / dt);
        if (expectedIdx <= currentIdx) break;
        currentIdx = Math.min(expectedIdx, DATA.frameEnd);
        updateUi(root, assetsByFoot);
        if (currentIdx >= DATA.frameEnd) {{
          stopPlayback();
          updateUi(root, assetsByFoot);
          return;
        }}
      }}

      rafId = requestAnimationFrame(() => playLoop(root, assetsByFoot));
    }}

    function render(root) {{
      const stepInfo = DATA.selectedStep
        ? `Schritt ${{DATA.selectedStep.id}} (${{DATA.selectedStep.footLabel}}): `
          + `${{DATA.selectedStep.startT.toFixed(2)}}–${{DATA.selectedStep.endT.toFixed(2)}} s · `
          + `Aktivierung: ${{DATA.selectedStep.activationOrder || "–"}} · `
          + `Ferse→Vorfuß: ${{(DATA.selectedStep.heelToForefootRatio === null || DATA.selectedStep.heelToForefootRatio === undefined) ? "–" : DATA.selectedStep.heelToForefootRatio}} · `
          + `${{DATA.selectedStep.classification || DATA.selectedStep.contactPattern || ""}}`
        : "Gesamte Aufnahme – jeder Frame zeigt den aktuellen Rohdruck (kein Session-Mittelwert).";

      root.innerHTML = `
        <h3 class="replay-title">Live-Animation</h3>
        <div class="replay-step-info">${{stepInfo}} · <strong>Play</strong> startet die CSV Zeile für Zeile.</div>
        <section class="replay-controls">
          <button type="button" id="replay-play">▶ Play</button>
          <div class="replay-controls__speeds">
            <button type="button" data-speed="0.5">0.5×</button>
            <button type="button" data-speed="1" class="active">1×</button>
            <button type="button" data-speed="2">2×</button>
          </div>
          <div class="replay-controls__slider">
            <input id="replay-slider" type="range" min="${{DATA.frameStart}}" max="${{DATA.frameEnd}}" value="${{currentIdx}}" />
          </div>
          <div class="replay-controls__time" id="replay-time">0.00 s</div>
          <div class="replay-controls__norm">
            <label><input type="radio" name="norm" value="session" ${{normMode === "session" ? "checked" : ""}} /> Session-Max</label>
            <label><input type="radio" name="norm" value="step" ${{normMode === "step" ? "checked" : ""}} /> Schritt-Max</label>
          </div>
        </section>
        <div class="replay-cards">
          <section class="replay-card">
            <div class="replay-card__header">
              <span>${{DATA.footLabels.left}}</span>
              <span class="replay-card__total" data-total="left">0 raw</span>
            </div>
            <canvas data-foot="left" aria-label="Druck-Replay links"></canvas>
          </section>
          <section class="replay-card">
            <div class="replay-card__header">
              <span>${{DATA.footLabels.right}}</span>
              <span class="replay-card__total" data-total="right">0 raw</span>
            </div>
            <canvas data-foot="right" aria-label="Druck-Replay rechts"></canvas>
          </section>
        </div>
        <section class="replay-timeline">
          <div class="replay-timeline__title">Zeitleiste (Summendruck L/R, Schritte markiert)</div>
          <canvas id="replay-timeline-canvas" aria-label="Replay-Zeitleiste"></canvas>
          <div class="replay-timeline__legend">
            <span class="left">Links Summe</span>
            <span class="right">Rechts Summe</span>
          </div>
        </section>
      `;

      const assetEntries = FOOT_KEYS.map(function(footKey) {{
        const asset = DATA.assets[footKey];
        return Promise.all([
          loadImage(asset.templateSrc),
          loadImage(asset.maskSrc),
        ]).then(function(images) {{
          return [footKey, {{ template: images[0], mask: images[1] }}];
        }});
      }});

      Promise.all(assetEntries).then((entries) => {{
        const assetsByFoot = {{}};
        entries.forEach(function(entry) {{
          assetsByFoot[entry[0]] = entry[1];
        }});

        root.querySelector("#replay-play").addEventListener("click", () => {{
          playing = !playing;
          playAnchor = playing ? {{ idx: currentIdx, time: performance.now() }} : null;
          if (playing) playLoop(root, assetsByFoot);
          else stopPlayback();
          updateUi(root, assetsByFoot);
        }});

        root.querySelectorAll("[data-speed]").forEach((btn) => {{
          btn.addEventListener("click", () => {{
            speed = Number(btn.dataset.speed);
            root.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("active", b === btn));
            if (playing) playAnchor = {{ idx: currentIdx, time: performance.now() }};
          }});
        }});

        root.querySelector("#replay-slider").addEventListener("input", (event) => {{
          stopPlayback();
          seekTo(Number(event.target.value), root, assetsByFoot);
        }});

        root.querySelectorAll('input[name="norm"]').forEach((input) => {{
          input.addEventListener("change", () => {{
            normMode = input.value;
            updateUi(root, assetsByFoot);
          }});
        }});

        const timeline = root.querySelector("#replay-timeline-canvas");
        timeline.addEventListener("click", (event) => {{
          const rect = timeline.getBoundingClientRect();
          const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
          const idx = Math.round(DATA.frameStart + ratio * (DATA.frameEnd - DATA.frameStart));
          stopPlayback();
          seekTo(idx, root, assetsByFoot);
        }});

        const redraw = () => updateUi(root, assetsByFoot);

        // Robust gegen versteckte Streamlit-Tabs: mehrfach nachzeichnen.
        let warmupAttempts = 0;
        const warmup = () => {{
          redraw();
          warmupAttempts += 1;
          if (warmupAttempts < 360) {{
            requestAnimationFrame(warmup);
          }}
        }};
        requestAnimationFrame(warmup);

        if (typeof ResizeObserver !== "undefined") {{
          const observer = new ResizeObserver(() => redraw());
          observer.observe(root);
        }}
        window.addEventListener("resize", redraw, {{ passive: true }});
        document.addEventListener("visibilitychange", () => {{
          if (!document.hidden) {{
            redraw();
          }}
        }});
      }}).catch((error) => {{
        console.error(error);
        root.innerHTML = '<div class="replay-step-info">Replay konnte nicht geladen werden.</div>';
      }});
    }}

    try {{
      render(document.getElementById("replay-root"));
    }} catch (error) {{
      const root = document.getElementById("replay-root");
      if (root) {{
        root.innerHTML = `<div class="replay-step-info">Replay-Fehler: ${{error && error.message ? error.message : error}}</div>`;
      }}
      console.error(error);
    }}
  </script>
</body>
</html>"""


def render_foot_replay(
    replay: ReplaySequence,
    *,
    frame_start: int = 0,
    frame_end: int | None = None,
    selected_step: dict | None = None,
    show_labels: bool = False,
    height: int = REPLAY_COMPONENT_HEIGHT,
) -> None:
    """Render the replay player in Streamlit."""
    import streamlit.components.v1 as components

    components.html(
        build_replay_canvas_html(
            replay,
            frame_start=frame_start,
            frame_end=frame_end,
            selected_step=selected_step,
            show_labels=show_labels,
        ),
        height=height,
        scrolling=True,
    )


def _layout_entry(entry: dict) -> dict:
    return {
        "id": entry["id"],
        "number": entry["number"],
        "label": entry["label"],
        "x": entry["x"],
        "y": entry["y"],
        "radiusX": entry["radiusX"],
        "radiusY": entry["radiusY"],
        "rotation": entry["rotation"],
        "maxSpread": entry["maxSpread"],
    }
