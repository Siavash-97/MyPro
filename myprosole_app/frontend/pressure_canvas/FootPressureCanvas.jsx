import React, { useEffect, useRef } from "react";

import { pressureAlpha, pressureColor } from "./pressureColor";
import { layoutForFoot } from "./sensorLayout";

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

function drawPressureCanvas(canvas, foot, template, mask, maxPressure, showLabels) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * scale);
  const height = Math.round(rect.height * scale);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  if (!foot?.sensors?.length) {
    return;
  }

  drawMirroredImage(ctx, template, foot.id === "right", width, height);

  const heatmap = document.createElement("canvas");
  heatmap.width = width;
  heatmap.height = height;
  const heatCtx = heatmap.getContext("2d");
  const pressureMax = maxPressure > 0 ? maxPressure : 1;

  foot.sensors.forEach((sensor) => {
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const intensity = clamp(sensor.value / pressureMax, 0, 1);
    const x = (layout.xPercent / 100) * width;
    const y = (layout.yPercent / 100) * height;
    const radius = (layout.radiusPercent / 100) * Math.min(width, height);
    const color = pressureColor(intensity);
    const alpha = pressureAlpha(intensity);
    const gradient = heatCtx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, color.replace("rgb", "rgba").replace(")", `, ${alpha})`));
    gradient.addColorStop(0.62, color.replace("rgb", "rgba").replace(")", `, ${alpha * 0.72})`));
    gradient.addColorStop(0.9, color.replace("rgb", "rgba").replace(")", `, ${alpha * 0.18})`));
    gradient.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));

    heatCtx.fillStyle = gradient;
    heatCtx.beginPath();
    heatCtx.arc(x, y, radius, 0, Math.PI * 2);
    heatCtx.fill();
  });

  heatCtx.globalCompositeOperation = "destination-in";
  drawMirroredImage(heatCtx, mask, foot.id === "right", width, height);
  ctx.drawImage(heatmap, 0, 0);

  if (showLabels) {
    drawLabels(ctx, foot, pressureMax, width, height);
  }
}

function drawLabels(ctx, foot, maxPressure, width, height) {
  const scale = window.devicePixelRatio || 1;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${12 * scale}px Inter, system-ui, sans-serif`;

  foot.sensors.forEach((sensor) => {
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const x = (layout.xPercent / 100) * width;
    const y = (layout.yPercent / 100) * height;
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

  return hasAnyData ? (
    <div className="pressure-map">
      {feet.map((foot) => (
        <section className="pressure-card" key={foot.id}>
          <header className="pressure-card__header">
            <strong>{foot.label}</strong>
            {foot.sensors.length > 0 ? <span>{foot.totalPressure.toFixed(0)} raw</span> : null}
          </header>
          <div className="pressure-card__stage">
            <canvas ref={(node) => { canvasRefs.current[foot.id] = node; }} />
            {foot.sensors.length === 0 ? <div className="pressure-card__empty">Keine Daten</div> : null}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <section className="pressure-card pressure-card--empty">Keine Daten</section>
  );
}
