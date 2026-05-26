"""Canvas-based pressure visualizations for Streamlit."""

from __future__ import annotations

import base64
import json
from pathlib import Path

from core.domain.pressure_analysis import PressureAnalysisResult
from core.domain.sensor_mapping import (
    FOOT_LABELS,
    FOOT_ORDER,
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    REGION_LABELS,
    RIGHT,
    columns_for_region,
)

APP_ROOT = Path(__file__).resolve().parents[2]
FOOT_TEMPLATE_PATH = APP_ROOT / "assets" / "foot_template.png"
FOOT_MASK_PATH = APP_ROOT / "assets" / "foot_mask.png"

PRESSURE_CANVAS_WIDTH = 980
PRESSURE_CANVAS_HEIGHT = 610
CARD_CANVAS_WIDTH = 410
CARD_CANVAS_HEIGHT = 500

REGION_SUMMARY_KEYS = {
    HEEL: ("heel_pressure_raw", "heel_percentage"),
    LATERAL_FOREFOOT: ("lateral_forefoot_raw", "lateral_forefoot_percentage"),
    MEDIAL_FOREFOOT: ("medial_forefoot_raw", "medial_forefoot_percentage"),
}

# Percent coordinates on the fixed upright template. The right side mirrors x.
SENSOR_LAYOUT = {
    HEEL: {"xPercent": 51.0, "yPercent": 80.0, "radiusPercent": 21.0},
    LATERAL_FOREFOOT: {"xPercent": 40.0, "yPercent": 28.0, "radiusPercent": 22.0},
    MEDIAL_FOREFOOT: {"xPercent": 62.0, "yPercent": 23.0, "radiusPercent": 23.0},
}


def plot_pressure_distribution(
    analysis: PressureAnalysisResult,
    *,
    show_labels: bool = False,
) -> str:
    """Return the standalone Canvas HTML used by the Streamlit pressure map."""
    return build_pressure_canvas_html(analysis, show_labels=show_labels)


def render_pressure_distribution(
    analysis: PressureAnalysisResult,
    *,
    show_labels: bool = False,
    height: int = PRESSURE_CANVAS_HEIGHT,
) -> None:
    """Render the pressure map as an embedded HTML Canvas component in Streamlit."""
    import streamlit.components.v1 as components

    components.html(
        build_pressure_canvas_html(analysis, show_labels=show_labels),
        height=height,
        scrolling=False,
    )


def build_pressure_canvas_payload(
    analysis: PressureAnalysisResult,
    *,
    show_labels: bool = False,
) -> dict:
    """Build the serializable payload consumed by the Canvas renderer."""
    feet = []
    raw_values: list[float] = []

    for foot in FOOT_ORDER:
        sensors = []
        for region in SENSOR_LAYOUT:
            if not _region_available(analysis, foot, region):
                continue
            raw_value, percentage = _region_values(analysis, foot, region)
            raw_values.append(raw_value)
            layout = SENSOR_LAYOUT[region]
            x_percent = 100.0 - layout["xPercent"] if foot == RIGHT else layout["xPercent"]
            sensors.append(
                {
                    "id": region,
                    "label": REGION_LABELS[region].split(" / ")[0],
                    "value": raw_value,
                    "percentage": percentage,
                    "xPercent": x_percent,
                    "yPercent": layout["yPercent"],
                    "radiusPercent": layout["radiusPercent"],
                }
            )

        foot_summary = analysis.per_foot_summary.get(foot, {})
        feet.append(
            {
                "id": foot,
                "label": FOOT_LABELS.get(foot, foot.title()),
                "mirror": foot == RIGHT,
                "totalPressure": float(foot_summary.get("total_pressure_raw", 0.0)),
                "sensors": sensors,
                "hasData": bool(sensors),
            }
        )

    max_pressure = max(raw_values) if raw_values else 0.0
    left_distribution = float(
        analysis.bilateral_summary.get("left_right_distribution_percentage", 0.0)
    )
    total_pressure = float(analysis.bilateral_summary.get("total_pressure_both", 0.0))
    right_distribution = 100.0 - left_distribution if total_pressure > 0 else 0.0

    return {
        "showLabels": show_labels,
        "maxPressure": max_pressure,
        "feet": feet,
        "summary": {
            "leftDistribution": left_distribution,
            "rightDistribution": right_distribution,
            "totalPressure": total_pressure,
        },
    }


def build_pressure_canvas_html(
    analysis: PressureAnalysisResult,
    *,
    show_labels: bool = False,
) -> str:
    """Build a self-contained HTML Canvas visualization for Streamlit."""
    template_uri = _asset_data_uri(FOOT_TEMPLATE_PATH, "image/png")
    mask_uri = _asset_data_uri(FOOT_MASK_PATH, "image/png")
    payload = build_pressure_canvas_payload(analysis, show_labels=show_labels)
    state_json = json.dumps(
        {
            "templateSrc": template_uri,
            "maskSrc": mask_uri,
            "payload": payload,
        },
        ensure_ascii=False,
    )

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
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      background: transparent;
      color: #0f172a;
    }}
    .pressure-map {{
      width: 100%;
      max-width: {PRESSURE_CANVAS_WIDTH}px;
      margin: 0 auto;
      padding: 8px 4px 0;
    }}
    .pressure-map__title {{
      margin: 0 0 12px;
      text-align: center;
      font-size: 18px;
      font-weight: 750;
      letter-spacing: -0.01em;
    }}
    .pressure-map__cards {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }}
    .pressure-card {{
      min-width: 0;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 22px;
      background: #ffffff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    }}
    .pressure-card__header {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px 0;
    }}
    .pressure-card__title {{
      font-size: 15px;
      font-weight: 750;
    }}
    .pressure-card__total {{
      color: #64748b;
      font-size: 12px;
      white-space: nowrap;
    }}
    .pressure-card__stage {{
      position: relative;
      padding: 8px 14px 14px;
    }}
    .pressure-card canvas {{
      display: block;
      width: 100%;
      height: min(52vw, {CARD_CANVAS_HEIGHT}px);
      max-height: {CARD_CANVAS_HEIGHT}px;
    }}
    .pressure-card__empty {{
      position: absolute;
      inset: 8px 14px 14px;
      display: grid;
      place-items: center;
      color: #94a3b8;
      font-size: 16px;
      font-weight: 750;
      pointer-events: none;
    }}
    .pressure-map__summary {{
      margin: 12px 0 0;
      text-align: center;
      color: #475569;
      font-size: 13px;
    }}
    .pressure-map__note {{
      margin: 4px 0 0;
      text-align: center;
      color: #64748b;
      font-size: 11px;
    }}
    @media (max-width: 720px) {{
      .pressure-map__cards {{
        grid-template-columns: 1fr;
      }}
      .pressure-card canvas {{
        height: 520px;
      }}
    }}
  </style>
</head>
<body>
  <div id="pressure-map-root" class="pressure-map" aria-label="Druckkarte"></div>
  <script>
    const STATE = {state_json};

    function clamp(value, min, max) {{
      return Math.min(max, Math.max(min, value));
    }}

    function pressureColor(intensity) {{
      const stops = [
        [0.00, [0, 87, 255]],
        [0.32, [0, 210, 106]],
        [0.62, [255, 230, 0]],
        [1.00, [255, 31, 31]],
      ];
      const t = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
      for (let index = 1; index < stops.length; index += 1) {{
        const [position, rgb] = stops[index];
        const [previousPosition, previousRgb] = stops[index - 1];
        if (t <= position) {{
          const localT = (t - previousPosition) / (position - previousPosition);
          const mixed = rgb.map((channel, channelIndex) =>
            Math.round(previousRgb[channelIndex] + (channel - previousRgb[channelIndex]) * localT)
          );
          return `rgb(${{mixed[0]}}, ${{mixed[1]}}, ${{mixed[2]}})`;
        }}
      }}
      return "rgb(255, 31, 31)";
    }}

    function loadImage(src) {{
      return new Promise((resolve, reject) => {{
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      }});
    }}

    function drawMirroredImage(ctx, image, mirror, width, height) {{
      ctx.save();
      if (mirror) {{
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }}
      ctx.drawImage(image, 0, 0, width, height);
      ctx.restore();
    }}

    function drawFoot(canvas, foot, template, mask, payload) {{
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);

      if (!foot.hasData) {{
        return;
      }}

      drawMirroredImage(ctx, template, foot.mirror, width, height);

      const heatmap = document.createElement("canvas");
      heatmap.width = width;
      heatmap.height = height;
      const heatCtx = heatmap.getContext("2d");

      const maxPressure = payload.maxPressure > 0 ? payload.maxPressure : 1;
      foot.sensors.forEach((sensor) => {{
        const intensity = clamp(sensor.value / maxPressure, 0, 1);
        const x = (sensor.xPercent / 100) * width;
        const y = (sensor.yPercent / 100) * height;
        const radius = (sensor.radiusPercent / 100) * Math.min(width, height);
        const gradient = heatCtx.createRadialGradient(x, y, 0, x, y, radius);
        const color = pressureColor(intensity);
        const alpha = 0.52 + 0.43 * intensity;
        gradient.addColorStop(0, color.replace("rgb", "rgba").replace(")", `, ${{alpha}})`));
        gradient.addColorStop(0.62, color.replace("rgb", "rgba").replace(")", `, ${{alpha * 0.72}})`));
        gradient.addColorStop(0.9, color.replace("rgb", "rgba").replace(")", `, ${{alpha * 0.18}})`));
        gradient.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));
        heatCtx.fillStyle = gradient;
        heatCtx.beginPath();
        heatCtx.arc(x, y, radius, 0, Math.PI * 2);
        heatCtx.fill();
      }});

      heatCtx.globalCompositeOperation = "destination-in";
      drawMirroredImage(heatCtx, mask, foot.mirror, width, height);

      ctx.drawImage(heatmap, 0, 0);

      if (payload.showLabels) {{
        drawSensorLabels(ctx, foot, payload, width, height);
      }}
    }}

    function drawSensorLabels(ctx, foot, payload, width, height) {{
      const maxPressure = payload.maxPressure > 0 ? payload.maxPressure : 1;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${{12 * (window.devicePixelRatio || 1)}}px Inter, system-ui, sans-serif`;
      foot.sensors.forEach((sensor) => {{
        const x = (sensor.xPercent / 100) * width;
        const y = (sensor.yPercent / 100) * height;
        const intensity = clamp(sensor.value / maxPressure, 0, 1);
        const label = `${{sensor.label}}\\n${{sensor.percentage.toFixed(1)}} % · ${{sensor.value.toFixed(0)}} raw`;
        const lines = label.split("\\n");
        const lineHeight = 16 * (window.devicePixelRatio || 1);
        const boxWidth = 138 * (window.devicePixelRatio || 1);
        const boxHeight = 42 * (window.devicePixelRatio || 1);
        const boxX = clamp(x - boxWidth / 2, 8, width - boxWidth - 8);
        const boxY = clamp(y - boxHeight / 2, 8, height - boxHeight - 8);

        ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
        ctx.strokeStyle = intensity > 0.65 ? "rgba(220, 38, 38, 0.45)" : "rgba(148, 163, 184, 0.45)";
        ctx.lineWidth = window.devicePixelRatio || 1;
        roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 10 * (window.devicePixelRatio || 1));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        lines.forEach((line, index) => {{
          ctx.fillText(line, boxX + boxWidth / 2, boxY + boxHeight / 2 + (index - 0.5) * lineHeight);
        }});
      }});
      ctx.restore();
    }}

    function roundRect(ctx, x, y, width, height, radius) {{
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }}

    function render(root, state) {{
      const payload = state.payload;
      const summary = payload.summary;
      if (payload.feet.every((foot) => !foot.hasData)) {{
        root.innerHTML = `
          <section class="pressure-card" style="min-height: 260px; display: grid; place-items: center;">
            <div class="pressure-card__empty" style="position: static;">Keine Daten</div>
          </section>
        `;
        return;
      }}

      root.innerHTML = `
        <h3 class="pressure-map__title">Druckkarte</h3>
        <div class="pressure-map__cards">
          ${{payload.feet.map((foot) => `
            <section class="pressure-card" data-foot="${{foot.id}}">
              <div class="pressure-card__header">
                <div class="pressure-card__title">${{foot.label}}</div>
                <div class="pressure-card__total">${{foot.hasData ? `${{foot.totalPressure.toFixed(0)}} raw` : ""}}</div>
              </div>
              <div class="pressure-card__stage">
                <canvas aria-label="Druckkarte ${{foot.label}}"></canvas>
                ${{foot.hasData ? "" : `<div class="pressure-card__empty">Keine Daten</div>`}}
              </div>
            </section>
          `).join("")}}
        </div>
        <p class="pressure-map__summary">
          Links/Rechts-Verteilung: ${{summary.leftDistribution.toFixed(1)}} % links |
          ${{summary.rightDistribution.toFixed(1)}} % rechts
        </p>
        <p class="pressure-map__note">
          Heatmap aus vorhandenen Sensorwerten; Farbintensität relativ zur aktuellen Messung.
        </p>
      `;

      Promise.all([loadImage(state.templateSrc), loadImage(state.maskSrc)]).then(([template, mask]) => {{
        const canvases = root.querySelectorAll("canvas");
        payload.feet.forEach((foot, index) => drawFoot(canvases[index], foot, template, mask, payload));
        window.addEventListener("resize", () => {{
          payload.feet.forEach((foot, index) => drawFoot(canvases[index], foot, template, mask, payload));
        }}, {{ passive: true }});
      }}).catch(() => {{
        root.innerHTML = '<div class="pressure-card__empty">Druckkarte konnte nicht geladen werden</div>';
      }});
    }}

    render(document.getElementById("pressure-map-root"), STATE);
  </script>
</body>
</html>"""


def _asset_data_uri(path: Path, mime_type: str) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"Pressure map asset not found: {path}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _region_values(
    analysis: PressureAnalysisResult,
    foot: str,
    region: str,
) -> tuple[float, float]:
    raw_key, percentage_key = REGION_SUMMARY_KEYS[region]
    foot_summary = analysis.per_foot_summary.get(foot, {})
    return (
        float(foot_summary.get(raw_key, 0.0)),
        float(foot_summary.get(percentage_key, 0.0)),
    )


def _region_available(analysis: PressureAnalysisResult, foot: str, region: str) -> bool:
    available_columns = set(analysis.sensor_columns.get(foot, []))
    return any(column in available_columns for column in columns_for_region(foot, region))
