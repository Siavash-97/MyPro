/*
  Step 8: Live-Tracking (live-tracking.html) – GPS-Aufzeichnung.
  Erzeugt einen run in der runs-Tabelle, zeichnet GPS-Punkte auf und
  aktualisiert Timer und Statistiken live. Beim Beenden wird der Lauf
  abgeschlossen und zur Tagebuch-Seite weitergeleitet.
*/
(() => {
  "use strict";

  var runId = null;
  var timerInterval = null;
  var startTime = null;
  var pausedTime = 0;
  var isPaused = false;
  var pauseStart = null;
  var watchId = null;
  var totalDistance = 0;
  var lastLat = null;
  var lastLng = null;
  var elevationGain = 0;
  var lastAlt = null;
  var pointBuffer = [];
  var flushTimer = null;

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var page = location.pathname.split("/").pop() || "index.html";
    if (page !== "live-tracking.html") return;

    var sb = M.db;
    var uid = M.user.id;

    await resumeOrStartRun(sb, uid);
    setupControls(sb, uid);

    window.addEventListener("beforeunload", function () {
      if (runId && timerInterval) finishRun(sb);
    });
  });

  async function resumeOrStartRun(sb, uid) {
    var existing = await sb.from("runs")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "tracking")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data) {
      runId = existing.data.id;
      startTime = Date.now();
      startTimer();
      startGPS(sb);
      return;
    }

    var res = await sb.from("runs").insert({
      user_id: uid,
      status: "tracking"
    }).select("id").single();

    if (res.error || !res.data) return;

    runId = res.data.id;
    startTime = Date.now();
    startTimer();
    startGPS(sb);
  }

  function startTimer() {
    var timerEl = document.querySelector(".md-timer");
    if (!timerEl) return;

    timerInterval = setInterval(function () {
      if (isPaused) return;
      var elapsed = Math.floor((Date.now() - startTime - pausedTime) / 1000);
      var m = Math.floor(elapsed / 60);
      var s = elapsed % 60;
      timerEl.textContent = pad2(m) + ":" + pad2(s);

      updateStats(elapsed);
    }, 1000);
  }

  function updateStats(elapsedSec) {
    var stats = document.querySelectorAll(".md-live-stat__value");
    if (stats.length < 1) return;

    if (stats[0]) stats[0].textContent = (totalDistance / 1000).toFixed(1);

    if (stats[1] && totalDistance > 100 && elapsedSec > 0) {
      var paceSecPerKm = Math.round(elapsedSec / (totalDistance / 1000));
      var pm = Math.floor(paceSecPerKm / 60);
      var ps = paceSecPerKm % 60;
      stats[1].textContent = pm + ":" + pad2(ps);
    }

    if (stats[2]) stats[2].textContent = Math.round(elevationGain);
  }

  function startGPS(sb) {
    if (!navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var alt = pos.coords.altitude;
        var acc = pos.coords.accuracy;
        var spd = pos.coords.speed;

        if (acc > 50) return;

        if (lastLat !== null) {
          totalDistance += haversine(lastLat, lastLng, lat, lng);
        }
        if (alt !== null && lastAlt !== null && alt > lastAlt) {
          elevationGain += (alt - lastAlt);
        }

        lastLat = lat;
        lastLng = lng;
        if (alt !== null) lastAlt = alt;

        if (runId && !isPaused) {
          var bt = window.MyProSole.bluetooth;
          var hr = (bt && bt.getLastHeartRate) ? bt.getLastHeartRate() : null;

          pointBuffer.push({
            run_id: runId,
            recorded_at: new Date(pos.timestamp).toISOString(),
            latitude: lat,
            longitude: lng,
            altitude_m: alt,
            accuracy_m: acc,
            speed_mps: spd,
            heart_rate_bpm: hr
          });

          if (!flushTimer) {
            flushTimer = setTimeout(function () {
              flushPoints(sb);
              flushTimer = null;
            }, 5000);
          }
        }
      },
      function () {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }

  async function flushPoints(sb) {
    if (pointBuffer.length === 0) return;
    var batch = pointBuffer.slice();
    pointBuffer = [];
    var result = await sb.from("run_points").insert(batch);
    if (result.error) pointBuffer = batch.concat(pointBuffer);
  }

  function setupControls(sb, uid) {
    var stopBtn = document.querySelector('a[href*="trainingstagebuch"]');
    if (stopBtn) {
      stopBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        await finishRun(sb);
        var url = new URL(stopBtn.href, location.href);
        if (runId) url.searchParams.set("run_id", runId);
        location.href = url.toString();
      });
    }

    var pauseBtn = document.querySelector('button[aria-label="Pausieren"]');
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function () {
        if (isPaused) {
          pausedTime += Date.now() - pauseStart;
          isPaused = false;
          pauseBtn.setAttribute("aria-label", "Pausieren");
          pauseBtn.innerHTML = '<svg class="icon" style="width:32px;height:32px;"><use href="#icon-pause"/></svg>';
        } else {
          isPaused = true;
          pauseStart = Date.now();
          pauseBtn.setAttribute("aria-label", "Fortsetzen");
          pauseBtn.innerHTML = '<svg class="icon" style="width:32px;height:32px;"><use href="#icon-play"/></svg>';
        }
      });
    }
  }

  async function finishRun(sb) {
    if (timerInterval) clearInterval(timerInterval);
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (flushTimer) clearTimeout(flushTimer);
    if (pointBuffer.length > 0) await flushPoints(sb);

    if (!runId) return;

    var elapsed = Math.floor((Date.now() - startTime - pausedTime) / 1000);
    var distKm = totalDistance / 1000;
    var avgPace = distKm > 0.1 ? Math.round(elapsed / distKm) : null;

    var bt = window.MyProSole.bluetooth;
    var avgHr = (bt && bt.getAvgHeartRate) ? bt.getAvgHeartRate() : null;
    var maxHr = (bt && bt.getMaxHeartRate) ? bt.getMaxHeartRate() : null;

    await sb.from("runs").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      paused_duration_s: Math.round(pausedTime / 1000),
      distance_km: Math.round(distKm * 1000) / 1000,
      duration_s: elapsed,
      avg_pace_s_per_km: avgPace,
      elevation_gain_m: Math.round(elevationGain * 10) / 10,
      avg_heart_rate_bpm: avgHr,
      max_heart_rate_bpm: maxHr
    }).eq("id", runId);

    if (bt && bt.disconnect) bt.disconnect();
  }

  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
})();
