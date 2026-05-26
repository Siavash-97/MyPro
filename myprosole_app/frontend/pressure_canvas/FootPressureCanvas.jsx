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

function sourceForFoot(side, sources, fallback) {
  const source = sources?.[side] ?? fallback;
  if (!source) {
    throw new Error(`Missing pressure-map asset for ${side}`);
  }
  return source;
}

function loadFootAssets(feet, templateSrcs, maskSrcs, templateSrc, maskSrc) {
  return Promise.all(
    feet.map(async (foot) => {
      const [template, mask] = await Promise.all([
        loadImage(sourceForFoot(foot.id, templateSrcs, templateSrc)),
        loadImage(sourceForFoot(foot.id, maskSrcs, maskSrc)),
      ]);

      return [foot.id, { template, mask }];
    }),
  ).then((entries) => Object.fromEntries(entries));
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
    drawTemplate(ctx, template, width, height, true);
    drawEmptySensorPlaceholders(ctx, foot.id, width, height);
    return;
  }

  drawTemplate(ctx, template, width, height, false);

  const heatmap = document.createElement("canvas");
  heatmap.width = width;
  heatmap.height = height;
  const heatCtx = heatmap.getContext("2d");
  const pressureMax = maxPressure > 0 ? maxPressure : 1;

  sensors.forEach((sensor) => {
    if (!(sensor.value > 0)) {
      return;
    }
    const layout = layoutForFoot(foot.id, sensor.id);
    if (!layout) {
      return;
    }

    const rawIntensity = clamp(sensor.value / pressureMax, 0, 1);
    const intensity = clamp(Number.isFinite(sensor.colorIntensity) ? sensor.colorIntensity : rawIntensity, 0, 1);
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
  heatCtx.drawImage(mask, 0, 0, width, height);
  ctx.drawImage(heatmap, 0, 0);

  if (showLabels) {
    drawLabels(ctx, foot, sensors, pressureMax, width, height);
  }
}

function drawTemplate(ctx, template, width, height, muted) {
  ctx.save();
  if (muted) {
    ctx.globalAlpha = 0.34;
    ctx.filter = "grayscale(1) saturate(0.25)";
  }
  ctx.drawImage(template, 0, 0, width, height);
  ctx.restore();
}

function drawEmptySensorPlaceholders(ctx, side, width, height) {
  const scale = window.devicePixelRatio || 1;
  ctx.save();
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
  });

  ctx.restore();
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
  templateSrcs,
  maskSrc,
  maskSrcs,
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

    loadFootAssets(feet, templateSrcs, maskSrcs, templateSrc, maskSrc).then((assetsByFoot) => {
      if (cancelled) {
        return;
      }

      feet.forEach((foot) => {
        const canvas = canvasRefs.current[foot.id];
        const assets = assetsByFoot[foot.id];
        if (canvas && assets) {
          drawPressureCanvas(canvas, foot, assets.template, assets.mask, maxPressure, showLabels);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [feet, maskSrc, maskSrcs, maxPressure, showLabels, templateSrc, templateSrcs]);

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
      <section className="pressure-scale-card" aria-label="Druckbasierter Farbhinweis">
        <strong>Druckbasierter Farbhinweis</strong>
        <div className="pressure-scale-card__bar" />
        <div className="pressure-scale-card__labels">
          <span>Neutral</span>
          <span>Abweichend</span>
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
