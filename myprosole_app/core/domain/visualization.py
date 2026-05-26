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
    LEFT,
    MEDIAL_FOREFOOT,
    RIGHT,
    columns_for_region,
)

APP_ROOT = Path(__file__).resolve().parents[2]
FOOT_TEMPLATE_PATHS = {
    LEFT: APP_ROOT / "assets" / "foot_template_left.png",
    RIGHT: APP_ROOT / "assets" / "foot_template_right.png",
}
FOOT_MASK_PATHS = {
    LEFT: APP_ROOT / "assets" / "foot_mask_left.png",
    RIGHT: APP_ROOT / "assets" / "foot_mask_right.png",
}
# Legacy aliases for callers that still import the old constants. The active
# renderer uses FOOT_TEMPLATE_PATHS/FOOT_MASK_PATHS for both sides.
FOOT_TEMPLATE_PATH = FOOT_TEMPLATE_PATHS[LEFT]
FOOT_MASK_PATH = FOOT_MASK_PATHS[LEFT]

PRESSURE_CANVAS_WIDTH = 980
PRESSURE_CANVAS_HEIGHT = 880
CARD_CANVAS_WIDTH = 410
CARD_CANVAS_HEIGHT = 650

REGION_SUMMARY_KEYS = {
    HEEL: ("heel_pressure_raw", "heel_percentage"),
    LATERAL_FOREFOOT: ("lateral_forefoot_raw", "lateral_forefoot_percentage"),
    MEDIAL_FOREFOOT: ("medial_forefoot_raw", "medial_forefoot_percentage"),
}

# Percent coordinates on the fixed upright PNG templates. Keep synced with
# frontend/pressure_canvas/sensorLayout.js; both sides are explicit assets.
LEFT_SENSOR_LAYOUT = (
    {
        "id": "sensor_1_heel",
        "number": 1,
        "label": "Ferse",
        "source_regions": (HEEL,),
        "x": 63.2,
        "y": 82.8,
        "radiusX": 12.0,
        "radiusY": 10.0,
        "rotation": 0.0,
        "maxSpread": 1.12,
    },
    {
        "id": "sensor_2_midfoot_lateral",
        "number": 2,
        "label": "Lateraler Mittelfuss",
        "source_regions": (LATERAL_FOREFOOT,),
        "x": 45.3,
        "y": 59.3,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.02,
    },
    {
        "id": "sensor_3_midfoot_medial",
        "number": 3,
        "label": "Medialer Mittelfuss",
        "source_regions": (MEDIAL_FOREFOOT,),
        "x": 36.0,
        "y": 43.2,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.02,
    },
    {
        "id": "sensor_4_little_toe_joint",
        "number": 4,
        "label": "Kleinzehengrundgelenk",
        "source_regions": (LATERAL_FOREFOOT,),
        "x": 49.6,
        "y": 33.9,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": -6.0,
        "maxSpread": 1.04,
    },
    {
        "id": "sensor_5_third_toe_joint",
        "number": 5,
        "label": "Mittlere Ballenlinie",
        "source_regions": (LATERAL_FOREFOOT, MEDIAL_FOREFOOT),
        "x": 66.9,
        "y": 31.9,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 5.0,
        "maxSpread": 1.03,
    },
    {
        "id": "sensor_6_big_toe_joint",
        "number": 6,
        "label": "Grosszehengrundgelenk",
        "source_regions": (MEDIAL_FOREFOOT,),
        "x": 64.8,
        "y": 56.5,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.04,
    },
)

RIGHT_SENSOR_LAYOUT = (
    {
        "id": "sensor_1_heel",
        "number": 1,
        "label": "Ferse",
        "source_regions": (HEEL,),
        "x": 36.8,
        "y": 82.8,
        "radiusX": 12.0,
        "radiusY": 10.0,
        "rotation": 0.0,
        "maxSpread": 1.12,
    },
    {
        "id": "sensor_2_midfoot_lateral",
        "number": 2,
        "label": "Lateraler Mittelfuss",
        "source_regions": (LATERAL_FOREFOOT,),
        "x": 54.7,
        "y": 59.3,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.02,
    },
    {
        "id": "sensor_3_midfoot_medial",
        "number": 3,
        "label": "Medialer Mittelfuss",
        "source_regions": (MEDIAL_FOREFOOT,),
        "x": 64.0,
        "y": 43.2,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.02,
    },
    {
        "id": "sensor_4_little_toe_joint",
        "number": 4,
        "label": "Kleinzehengrundgelenk",
        "source_regions": (LATERAL_FOREFOOT,),
        "x": 50.4,
        "y": 33.9,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 6.0,
        "maxSpread": 1.04,
    },
    {
        "id": "sensor_5_third_toe_joint",
        "number": 5,
        "label": "Mittlere Ballenlinie",
        "source_regions": (LATERAL_FOREFOOT, MEDIAL_FOREFOOT),
        "x": 33.1,
        "y": 31.9,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": -5.0,
        "maxSpread": 1.03,
    },
    {
        "id": "sensor_6_big_toe_joint",
        "number": 6,
        "label": "Grosszehengrundgelenk",
        "source_regions": (MEDIAL_FOREFOOT,),
        "x": 35.2,
        "y": 56.5,
        "radiusX": 8.0,
        "radiusY": 7.0,
        "rotation": 0.0,
        "maxSpread": 1.04,
    },
)

SENSOR_LAYOUTS = {
    LEFT: LEFT_SENSOR_LAYOUT,
    RIGHT: RIGHT_SENSOR_LAYOUT,
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
        layout_sensors = []
        for layout in SENSOR_LAYOUTS[foot]:
            layout_sensors.append(
                {
                    "id": layout["id"],
                    "number": layout["number"],
                    "label": layout["label"],
                    "x": layout["x"],
                    "y": layout["y"],
                    "radiusX": layout["radiusX"],
                    "radiusY": layout["radiusY"],
                    "rotation": layout["rotation"],
                    "maxSpread": layout["maxSpread"],
                }
            )

            source_regions = layout["source_regions"]
            if not _visual_sensor_available(analysis, foot, source_regions):
                continue
            raw_value, percentage = _visual_sensor_values(analysis, foot, source_regions)
            raw_values.append(raw_value)
            sensors.append(
                {
                    "id": layout["id"],
                    "number": layout["number"],
                    "label": layout["label"],
                    "value": raw_value,
                    "percentage": percentage,
                    "x": layout["x"],
                    "y": layout["y"],
                    "radiusX": layout["radiusX"],
                    "radiusY": layout["radiusY"],
                    "rotation": layout["rotation"],
                    "maxSpread": layout["maxSpread"],
                }
            )

        foot_summary = analysis.per_foot_summary.get(foot, {})
        feet.append(
            {
                "id": foot,
                "label": FOOT_LABELS.get(foot, foot.title()),
                "totalPressure": float(foot_summary.get("total_pressure_raw", 0.0)),
                "sensors": sensors,
                "layoutSensors": layout_sensors,
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
    asset_uris = {
        foot: {
            "templateSrc": _asset_data_uri(FOOT_TEMPLATE_PATHS[foot], "image/png"),
            "maskSrc": _asset_data_uri(FOOT_MASK_PATHS[foot], "image/png"),
        }
        for foot in FOOT_ORDER
    }
    payload = build_pressure_canvas_payload(analysis, show_labels=show_labels)
    state_json = json.dumps(
        {
            "assets": asset_uris,
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
      padding: 4px 10px 0;
    }}
    .pressure-map__title {{
      margin: 0 0 8px;
      text-align: center;
      font-size: clamp(26px, 4vw, 34px);
      line-height: 1.05;
      font-weight: 850;
      letter-spacing: -0.01em;
    }}
    .pressure-map__cards {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 26px;
    }}
    .pressure-card {{
      min-width: 0;
      overflow: hidden;
      border: 1px solid #e8edf5;
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.1);
    }}
    .pressure-card--empty {{
      background: linear-gradient(180deg, #fbfcff 0%, #f7f9ff 100%);
    }}
    .pressure-card__header {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 26px 0;
    }}
    .pressure-card__title {{
      font-size: clamp(22px, 3vw, 28px);
      font-weight: 850;
      letter-spacing: -0.02em;
    }}
    .pressure-card__total {{
      color: #667085;
      font-size: clamp(17px, 2vw, 21px);
      font-weight: 750;
      white-space: nowrap;
    }}
    .pressure-card__stage {{
      position: relative;
      padding: 2px 26px 8px;
    }}
    .pressure-card canvas {{
      display: block;
      width: 100%;
      height: min(66vw, {CARD_CANVAS_HEIGHT}px);
      max-height: {CARD_CANVAS_HEIGHT}px;
    }}
    .pressure-card__empty {{
      position: absolute;
      inset: 2px 26px 8px;
      display: grid;
      place-items: center;
      color: #6b7280;
      font-size: clamp(18px, 2.5vw, 24px);
      font-weight: 850;
      pointer-events: none;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);
    }}
    .pressure-scale-card,
    .pressure-distribution-card {{
      margin: 14px 0 0;
      border: 1px solid #e8edf5;
      border-radius: 22px;
      background: #ffffff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    }}
    .pressure-scale-card {{
      padding: 10px 13%;
      text-align: center;
    }}
    .pressure-scale-card__title {{
      display: block;
      margin: 0 0 6px;
      color: #111827;
      font-size: 18px;
      font-weight: 850;
    }}
    .pressure-scale-card__bar {{
      height: 20px;
      border-radius: 999px;
      background: linear-gradient(90deg, #3347ff 0%, #13c8ff 22%, #36e75d 45%, #fff21f 64%, #ff9118 80%, #ff1424 100%);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.58), 0 5px 14px rgba(79, 70, 229, 0.16);
    }}
    .pressure-scale-card__labels {{
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      color: #4b5563;
      font-size: 16px;
      font-weight: 750;
    }}
    .pressure-distribution-card {{
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr);
      align-items: center;
      gap: 18px;
      padding: 18px 13%;
    }}
    .pressure-distribution-card__label {{
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: #111827;
      font-size: 20px;
      font-weight: 850;
      line-height: 1.05;
    }}
    .pressure-distribution-card__label small {{
      color: #6b7280;
      font-size: 13px;
      font-weight: 700;
    }}
    .pressure-distribution-card__value {{
      text-align: center;
      color: #6d5dfc;
      font-size: 32px;
      font-weight: 900;
      line-height: 1.05;
    }}
    .pressure-distribution-card__value small {{
      display: block;
      margin-top: 2px;
      color: #4b5563;
      font-size: 14px;
      font-weight: 800;
    }}
    .pressure-distribution-card__value + .pressure-distribution-card__value {{
      border-left: 1px solid #e5e7eb;
    }}
    @media (max-width: 720px) {{
      .pressure-map__cards {{
        grid-template-columns: 1fr;
      }}
      .pressure-card canvas {{
        height: 620px;
      }}
      .pressure-distribution-card {{
        grid-template-columns: 1fr;
        text-align: center;
      }}
      .pressure-distribution-card__value + .pressure-distribution-card__value {{
        border-left: 0;
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

    function rgba(rgb, alpha) {{
      return rgb.replace("rgb", "rgba").replace(")", `, ${{alpha}})`);
    }}

    function drawEllipticalGradient(ctx, x, y, radiusX, radiusY, rotation, color, alpha) {{
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, rgba(color, alpha * 0.9));
      gradient.addColorStop(0.36, rgba(color, alpha * 0.42));
      gradient.addColorStop(0.7, rgba(color, alpha * 0.1));
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
        drawTemplate(ctx, template, width, height, true);
        drawEmptySensorPlaceholders(ctx, foot, width, height);
        return;
      }}

      drawTemplate(ctx, template, width, height, false);

      const heatmap = document.createElement("canvas");
      heatmap.width = width;
      heatmap.height = height;
      const heatCtx = heatmap.getContext("2d");

      const maxPressure = payload.maxPressure > 0 ? payload.maxPressure : 1;
      foot.sensors.forEach((sensor) => {{
        const intensity = clamp(sensor.value / maxPressure, 0, 1);
        const x = (sensor.x / 100) * width;
        const y = (sensor.y / 100) * height;
        const spread = (0.82 + 0.18 * intensity) * sensor.maxSpread;
        const radiusX = (sensor.radiusX / 100) * width * spread;
        const radiusY = (sensor.radiusY / 100) * height * spread;
        const color = pressureColor(intensity);
        const alpha = 0.62 + 0.34 * intensity;
        drawEllipticalGradient(heatCtx, x, y, radiusX, radiusY, sensor.rotation, color, alpha);
      }});

      heatCtx.globalCompositeOperation = "destination-in";
      heatCtx.drawImage(mask, 0, 0, width, height);

      ctx.drawImage(heatmap, 0, 0);
      drawSensorBadges(ctx, foot, payload, width, height);

      if (payload.showLabels) {{
        drawSensorLabels(ctx, foot, payload, width, height);
      }}
    }}

    function drawTemplate(ctx, template, width, height, muted) {{
      ctx.save();
      if (muted) {{
        ctx.globalAlpha = 0.34;
        ctx.filter = "grayscale(1) saturate(0.25)";
      }}
      ctx.drawImage(template, 0, 0, width, height);
      ctx.restore();
    }}

    function drawSensorBadges(ctx, foot, payload, width, height) {{
      const maxPressure = payload.maxPressure > 0 ? payload.maxPressure : 1;
      const scale = window.devicePixelRatio || 1;
      foot.sensors.forEach((sensor) => {{
        const intensity = clamp(sensor.value / maxPressure, 0, 1);
        const x = (sensor.x / 100) * width;
        const y = (sensor.y / 100) * height;
        const radius = Math.max(
          20 * scale,
          Math.min((sensor.radiusX / 100) * width, (sensor.radiusY / 100) * height)
        );
        const color = pressureColor(intensity);
        const gradient = ctx.createRadialGradient(
          x - radius * 0.28,
          y - radius * 0.32,
          radius * 0.12,
          x,
          y,
          radius
        );

        gradient.addColorStop(0, "rgba(255, 255, 255, 0.72)");
        gradient.addColorStop(0.22, color);
        gradient.addColorStop(1, color);

        ctx.save();
        ctx.shadowColor = rgba(color, 0.45);
        ctx.shadowBlur = 20 * scale;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.stroke();

        ctx.fillStyle = textColorFor(color);
        ctx.font = `${{Math.max(18 * scale, radius * 0.78)}}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(sensor.number), x, y + radius * 0.04);
        ctx.restore();
      }});
    }}

    function drawEmptySensorPlaceholders(ctx, foot, width, height) {{
      const scale = window.devicePixelRatio || 1;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${{18 * scale}}px Inter, system-ui, sans-serif`;
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([5 * scale, 4 * scale]);

      foot.layoutSensors.forEach((sensor) => {{
        const x = (sensor.x / 100) * width;
        const y = (sensor.y / 100) * height;
        const radius = Math.max(
          18 * scale,
          Math.min((sensor.radiusX / 100) * width, (sensor.radiusY / 100) * height)
        );

        ctx.strokeStyle = "rgba(100, 116, 139, 0.38)";
        ctx.fillStyle = "rgba(100, 116, 139, 0.72)";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(String(sensor.number), x, y + radius * 0.04);
      }});
      ctx.restore();
    }}

    function textColorFor(rgb) {{
      const channels = rgb.match(/\\d+/g)?.map(Number) ?? [0, 0, 0];
      const [red, green, blue] = channels;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      return luminance > 0.68 ? "#111827" : "#ffffff";
    }}

    function drawSensorLabels(ctx, foot, payload, width, height) {{
      const maxPressure = payload.maxPressure > 0 ? payload.maxPressure : 1;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${{12 * (window.devicePixelRatio || 1)}}px Inter, system-ui, sans-serif`;
      foot.sensors.forEach((sensor) => {{
        const x = (sensor.x / 100) * width;
        const y = (sensor.y / 100) * height;
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

      root.innerHTML = `
        <h3 class="pressure-map__title">Druckkarte</h3>
        <div class="pressure-map__cards">
          ${{payload.feet.map((foot) => `
            <section class="pressure-card ${{foot.hasData ? "" : "pressure-card--empty"}}" data-foot="${{foot.id}}">
              <div class="pressure-card__header">
                <div class="pressure-card__title">${{foot.label}}</div>
                <div class="pressure-card__total">${{foot.hasData ? foot.totalPressure.toFixed(0) : "0"}} raw</div>
              </div>
              <div class="pressure-card__stage">
                <canvas aria-label="Druckkarte ${{foot.label}}"></canvas>
                ${{foot.hasData ? "" : `<div class="pressure-card__empty">Keine Daten</div>`}}
              </div>
            </section>
          `).join("")}}
        </div>
        <section class="pressure-scale-card" aria-label="Druckintensität">
          <strong class="pressure-scale-card__title">Druckintensität</strong>
          <div class="pressure-scale-card__bar"></div>
          <div class="pressure-scale-card__labels">
            <span>Niedrig</span>
            <span>Hoch</span>
          </div>
        </section>
        <section class="pressure-distribution-card" aria-label="Links/Rechts-Verteilung">
          <div class="pressure-distribution-card__label">
            Links/Rechts-Verteilung
            <small>(relativ zur Messung)</small>
          </div>
          <div class="pressure-distribution-card__value">
            ${{summary.leftDistribution.toFixed(1)}} %
            <small>links</small>
          </div>
          <div class="pressure-distribution-card__value">
            ${{summary.rightDistribution.toFixed(1)}} %
            <small>rechts</small>
          </div>
        </section>
      `;

      const assetEntries = payload.feet.map(async (foot) => {{
        const asset = state.assets[foot.id];
        const [template, mask] = await Promise.all([
          loadImage(asset.templateSrc),
          loadImage(asset.maskSrc),
        ]);
        return [foot.id, {{ template, mask }}];
      }});

      Promise.all(assetEntries).then((entries) => {{
        const assetsByFoot = Object.fromEntries(entries);
        const canvases = root.querySelectorAll("canvas");
        const drawAll = () => {{
          payload.feet.forEach((foot, index) => {{
            const assets = assetsByFoot[foot.id];
            drawFoot(canvases[index], foot, assets.template, assets.mask, payload);
          }});
        }};
        drawAll();
        window.addEventListener("resize", () => {{
          drawAll();
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


def _visual_sensor_available(
    analysis: PressureAnalysisResult,
    foot: str,
    source_regions: tuple[str, ...],
) -> bool:
    return any(_region_available(analysis, foot, region) for region in source_regions)


def _visual_sensor_values(
    analysis: PressureAnalysisResult,
    foot: str,
    source_regions: tuple[str, ...],
) -> tuple[float, float]:
    values = [
        _region_values(analysis, foot, region)
        for region in source_regions
        if _region_available(analysis, foot, region)
    ]

    if not values:
        return 0.0, 0.0

    raw_value = sum(value for value, _ in values) / len(values)
    percentage = sum(percentage for _, percentage in values) / len(values)
    return raw_value, percentage
