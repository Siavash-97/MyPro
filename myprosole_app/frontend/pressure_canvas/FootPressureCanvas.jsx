import React, { useEffect, useRef } from "react";

import { pressureAlpha, pressureColor } from "./pressureColor";
import { allLayoutSensorsForFoot, layoutForFoot, visualSensorsForFoot } from "./sensorLayout";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawMirroredImage(ctx, image, mirror, width, height) {
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, 0, 0, width, height);
  ctx.restore();
}

function rgba(rgb, alpha) {
  return rgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
}

function drawEllipticalGradient(ctx, x, y, radiusX, radiusY, rotation, color, alpha) {
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
}

function drawPressureCanvas(canvas, foot, template, mask, maxPressure, showLabels) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * scale);
  const height = Math.round(rect.height * scale);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const sensors = visualSensorsForFoot(foot.id, foot?.sensors ?? []);
  if (!sensors.length) {
    drawTemplate(ctx, template, foot.id === "right", width, height, true);
    drawEmptySensorPlaceholders(ctx, foot.id, width, height);
    return;
  }

  drawTemplate(ctx, template, foot.id === "right", width, height, false);

  const heatmap = document.createElement("canvas");
  heatmap.width = width;
  heatmap.height = height;
  const heatCtx = heatmap.getContext("2d");
  const pressureMax = maxPressure > 0 ? maxPressure : 1;

  sensors.forEach((sensor) => {
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const intensity = clamp(sensor.value / pressureMax, 0, 1);
    const x = (layout.x / 100) * width;
    const y = (layout.y / 100) * height;
    const spread = (0.82 + 0.18 * intensity) * layout.maxSpread;
    const radiusX = (layout.radiusX / 100) * width * spread;
    const radiusY = (layout.radiusY / 100) * height * spread;
    const color = pressureColor(intensity);
    const alpha = pressureAlpha(intensity);

    drawEllipticalGradient(heatCtx, x, y, radiusX, radiusY, layout.rotation, color, alpha);
  });

  heatCtx.globalCompositeOperation = "destination-in";
  drawMirroredImage(heatCtx, mask, foot.id === "right", width, height);
  ctx.drawImage(heatmap, 0, 0);

  drawSensorBadges(ctx, foot, sensors, pressureMax, width, height);

  if (showLabels) {
    drawLabels(ctx, foot, sensors, pressureMax, width, height);
  }
}

function drawTemplate(ctx, template, mirror, width, height, muted) {
  ctx.save();
  if (muted) {
    ctx.globalAlpha = 0.34;
    ctx.filter = "grayscale(1) saturate(0.25)";
  }
  drawMirroredImage(ctx, template, mirror, width, height);
  ctx.restore();
}

function drawSensorBadges(ctx, foot, sensors, maxPressure, width, height) {
  const scale = window.devicePixelRatio || 1;

  sensors.forEach((sensor) => {
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const intensity = clamp(sensor.value / maxPressure, 0, 1);
    const x = (layout.x / 100) * width;
    const y = (layout.y / 100) * height;
    const radius = Math.max(20 * scale, Math.min((layout.radiusX / 100) * width, (layout.radiusY / 100) * height));
    const color = pressureColor(intensity);
    const gradient = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.32, radius * 0.12, x, y, radius);

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.7)");
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
    ctx.stroke();

    ctx.fillStyle = textColorFor(color);
    ctx.font = `${Math.max(18 * scale, radius * 0.78)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(sensor.number ?? layout.number), x, y + radius * 0.04);
    ctx.restore();
  });
}

function drawEmptySensorPlaceholders(ctx, side, width, height) {
  const scale = window.devicePixelRatio || 1;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${18 * scale}px Inter, system-ui, sans-serif`;
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([5 * scale, 4 * scale]);

  allLayoutSensorsForFoot(side).forEach((sensor) => {
    const x = (sensor.x / 100) * width;
    const y = (sensor.y / 100) * height;
    const radius = Math.max(18 * scale, Math.min((sensor.radiusX / 100) * width, (sensor.radiusY / 100) * height));

    ctx.strokeStyle = "rgba(100, 116, 139, 0.38)";
    ctx.fillStyle = "rgba(100, 116, 139, 0.72)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(String(sensor.number), x, y + radius * 0.04);
  });

  ctx.restore();
}

function textColorFor(rgb) {
  const channels = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const [red, green, blue] = channels;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.68 ? "#111827" : "#ffffff";
}

function drawLabels(ctx, foot, sensors, maxPressure, width, height) {
  const scale = window.devicePixelRatio || 1;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${12 * scale}px Inter, system-ui, sans-serif`;

  sensors.forEach((sensor) => {
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const x = (layout.x / 100) * width;
    const y = (layout.y / 100) * height;
    const intensity = clamp(sensor.value / maxPressure, 0, 1);
    const boxWidth = 138 * scale;
    const boxHeight = 42 * scale;
    const boxX = clamp(x - boxWidth / 2, 8, width - boxWidth - 8);
    const boxY = clamp(y - boxHeight / 2, 8, height - boxHeight - 8);

    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.strokeStyle = intensity > 0.65 ? "rgba(220, 38, 38, 0.45)" : "rgba(148, 163, 184, 0.45)";
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 10 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(sensor.label, boxX + boxWidth / 2, boxY + boxHeight / 2 - 8 * scale);
    ctx.fillText(
      `${sensor.percentage.toFixed(1)} % · ${sensor.value.toFixed(0)} raw`,
      boxX + boxWidth / 2,
      boxY + boxHeight / 2 + 8 * scale,
    );
  });

  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export default function FootPressureCanvas({
  feet,
  maxPressure,
  templateSrc,
  maskSrc,
  showLabels = false,
}) {
  const canvasRefs = useRef({});
  const hasAnyData = feet.some((foot) => foot.sensors.length > 0);
  const totalPressure = feet.reduce((total, foot) => total + foot.totalPressure, 0);
  const leftPressure = feet.find((foot) => foot.id === "left")?.totalPressure ?? 0;
  const rightPressure = feet.find((foot) => foot.id === "right")?.totalPressure ?? 0;
  const leftDistribution = totalPressure > 0 ? (leftPressure / totalPressure) * 100 : 0;
  const rightDistribution = totalPressure > 0 ? (rightPressure / totalPressure) * 100 : 0;

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadImage(templateSrc), loadImage(maskSrc)]).then(([template, mask]) => {
      if (cancelled) {
        return;
      }

      feet.forEach((foot) => {
        const canvas = canvasRefs.current[foot.id];
        if (canvas) {
          drawPressureCanvas(canvas, foot, template, mask, maxPressure, showLabels);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [feet, maskSrc, maxPressure, showLabels, templateSrc]);

  return (
    <div className={`pressure-map${hasAnyData ? "" : " pressure-map--empty"}`}>
      <h3 className="pressure-map__title">Druckkarte</h3>
      <div className="pressure-map__cards">
      {feet.map((foot) => (
        <section className="pressure-card" key={foot.id}>
          <header className="pressure-card__header">
            <strong>{foot.label}</strong>
            <span>{foot.sensors.length > 0 ? foot.totalPressure.toFixed(0) : 0} raw</span>
          </header>
          <div className="pressure-card__stage">
            <canvas ref={(node) => { canvasRefs.current[foot.id] = node; }} />
            {foot.sensors.length === 0 ? <div className="pressure-card__empty">Keine Daten</div> : null}
          </div>
        </section>
      ))}
      </div>
      <section className="pressure-scale-card" aria-label="Druckintensität">
        <strong>Druckintensität</strong>
        <div className="pressure-scale-card__bar" />
        <div className="pressure-scale-card__labels">
          <span>Niedrig</span>
          <span>Hoch</span>
        </div>
      </section>
      <section className="pressure-distribution-card" aria-label="Links/Rechts-Verteilung">
        <strong>Links/Rechts-Verteilung</strong>
        <span>{leftDistribution.toFixed(1)} % links</span>
        <span>{rightDistribution.toFixed(1)} % rechts</span>
      </section>
    </div>
  );
}
