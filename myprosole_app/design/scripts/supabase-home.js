/*
  Step 4: Dashboard (home.html + verlauf.html) – echte Daten aus Supabase.
  Laedt Profil, Wochen-Laeufe und letzten Lauf und aktualisiert die statischen
  Platzhalter im DOM.
*/
(() => {
  "use strict";

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var sb = M.db;
    var uid = M.user.id;
    var page = location.pathname.split("/").pop() || "index.html";

    if (page === "home.html") await fillHome(sb, uid);
    if (page === "verlauf.html") await fillVerlauf(sb, uid);
  });

  async function fillHome(sb, uid) {
    var profile = await sb.from("profiles").select("display_name, weekly_goal_km").eq("id", uid).single();
    if (profile.data) {
      var name = profile.data.display_name;
      var greeting = greetByTime() + (name ? ", " + name.split(" ")[0] + "!" : "!");
      var el = document.querySelector(".md-greeting__title");
      if (el) el.textContent = greeting;
    }

    var weekStart = mondayOfWeek();
    var runs = await sb.from("runs")
      .select("distance_km, duration_s, started_at, avg_pace_s_per_km, score")
      .eq("user_id", uid)
      .eq("status", "completed")
      .gte("started_at", weekStart.toISOString())
      .order("started_at", { ascending: false });

    var list = (runs.data || []);
    var totalKm = 0;
    var totalSec = 0;
    for (var i = 0; i < list.length; i++) {
      totalKm += parseFloat(list[i].distance_km || 0);
      totalSec += parseInt(list[i].duration_s || 0, 10);
    }

    var goalKm = (profile.data && profile.data.weekly_goal_km) ? parseFloat(profile.data.weekly_goal_km) : 40;
    var pct = goalKm > 0 ? Math.min(100, Math.round((totalKm / goalKm) * 100)) : 0;

    var weekStat = document.querySelector(".md-card .md-row span");
    if (weekStat) weekStat.textContent = fmtKm(totalKm) + " / " + Math.round(goalKm) + " km";

    var bar = document.querySelector(".md-progress__fill");
    if (bar) bar.style.width = pct + "%";

    var metrics = document.querySelectorAll(".md-metric--accent");
    if (metrics.length >= 1) {
      var v1 = metrics[0].querySelector(".md-metric__value");
      if (v1) v1.innerHTML = list.length + " <span>diese Woche</span>";
    }
    if (metrics.length >= 2) {
      var v2 = metrics[1].querySelector(".md-metric__value");
      if (v2) v2.innerHTML = fmtHours(totalSec) + " <span>Stunden</span>";
    }

    if (list.length > 0) {
      var last = list[0];
      var lastCard = document.querySelector('a[href="lauf-zusammenfassung.html"]');
      if (lastCard) {
        var meta = lastCard.querySelector("p:last-of-type");
        if (meta) {
          var d = new Date(last.started_at);
          var dayStr = isToday(d) ? "Heute" : fmtDate(d);
          meta.textContent = dayStr + " · " + fmtKm(last.distance_km) + " km · " + fmtDuration(last.duration_s) + " min";
        }
      }
    }

    var cta = document.querySelector(".md-cta__plan");
    if (cta && list.length > 0) {
      var remainKm = Math.max(0, goalKm - totalKm);
      if (remainKm > 0) {
        cta.textContent = "Noch " + fmtKm(remainKm) + " km bis zum Wochenziel";
      } else {
        cta.textContent = "Wochenziel erreicht!";
      }
    }
  }

  async function fillVerlauf(sb, uid) {
    var weekStart = mondayOfWeek();
    var runs = await sb.from("runs")
      .select("distance_km, duration_s, started_at, avg_pace_s_per_km, score")
      .eq("user_id", uid)
      .eq("status", "completed")
      .gte("started_at", weekStart.toISOString())
      .order("started_at", { ascending: false });

    var list = (runs.data || []);
    var totalKm = 0;
    var totalSec = 0;
    var totalScore = 0;
    var scored = 0;
    for (var i = 0; i < list.length; i++) {
      totalKm += parseFloat(list[i].distance_km || 0);
      totalSec += parseInt(list[i].duration_s || 0, 10);
      if (list[i].score != null) { totalScore += list[i].score; scored++; }
    }

    var avgScore = scored > 0 ? Math.round(totalScore / scored) : 0;

    var scoreNum = document.querySelector(".md-score__number");
    if (scoreNum) scoreNum.textContent = avgScore || "--";

    var scoreRing = document.querySelector(".md-score__ring-value");
    if (scoreRing) {
      var circumference = 251.2;
      var offset = circumference - (circumference * (avgScore / 100));
      scoreRing.setAttribute("stroke-dashoffset", offset.toFixed(1));
    }

    var scoreCopy = document.querySelector(".md-analysis-score-copy");
    if (scoreCopy) scoreCopy.textContent = "Aus " + list.length + " " + (list.length === 1 ? "Lauf" : "Läufen") + " dieser Woche.";

    var distMetric = document.querySelectorAll(".md-metric--accent");
    if (distMetric.length >= 1) {
      var v1 = distMetric[0].querySelector(".md-metric__value");
      if (v1) v1.innerHTML = fmtKm(totalKm) + " <span>km</span>";
    }
    if (distMetric.length >= 2) {
      var v2 = distMetric[1].querySelector(".md-metric__value");
      if (v2) v2.innerHTML = fmtHours(totalSec) + " <span>Stunden</span>";
    }

    var container = document.querySelector(".md-section-title + div");
    if (!container) return;

    var items = container.querySelectorAll(".md-list-item");
    for (var j = 0; j < items.length; j++) items[j].remove();

    for (var k = 0; k < list.length; k++) {
      var r = list[k];
      var d = new Date(r.started_at);
      var sc = r.score || 0;
      var badge = sc >= 70 ? "good" : sc >= 50 ? "ok" : "low";
      var pace = r.avg_pace_s_per_km ? fmtPace(r.avg_pace_s_per_km) : "--:--";

      var a = document.createElement("a");
      a.className = "md-list-item";
      a.href = "analyse-ergebnis.html?mode=gps";
      a.style.textDecoration = "none";
      a.style.color = "inherit";
      a.innerHTML =
        '<div class="md-score-badge md-score-badge--' + badge + '">' + (sc || "--") + '</div>' +
        '<div class="md-list-item__body">' +
          '<p class="md-list-item__title">' + fmtDateFull(d) + '</p>' +
          '<p class="md-list-item__meta">' + fmtKm(r.distance_km) + ' km · ' + fmtDuration(r.duration_s) + ' min · ' + pace + ' min/km</p>' +
        '</div>' +
        '<svg class="icon md-row__chevron"><use href="#icon-chevron-right"/></svg>';
      container.appendChild(a);
    }

    if (list.length === 0) {
      var p = document.createElement("p");
      p.style.font = "var(--type-body-md)";
      p.style.color = "var(--md-on-surface-variant)";
      p.textContent = "Noch keine Läufe diese Woche.";
      container.appendChild(p);
    }
  }

  function greetByTime() {
    var h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  }

  function mondayOfWeek() {
    var now = new Date();
    var day = now.getDay();
    var diff = (day === 0 ? -6 : 1) - day;
    var mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  function fmtKm(v) { return parseFloat(v || 0).toFixed(1).replace(".", ","); }

  function fmtDuration(s) {
    var sec = parseInt(s || 0, 10);
    var m = Math.floor(sec / 60);
    var ss = sec % 60;
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  function fmtHours(s) {
    var sec = parseInt(s || 0, 10);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  function fmtPace(s) {
    var sec = parseInt(s || 0, 10);
    var m = Math.floor(sec / 60);
    var ss = sec % 60;
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  }

  function isToday(d) {
    var t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  }

  var TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  function fmtDate(d) {
    return TAGE[d.getDay()] + ", " + d.getDate() + "." + (d.getMonth() + 1) + ".";
  }

  function fmtDateFull(d) {
    if (isToday(d)) return "Heute, " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + " Uhr";
    return TAGE[d.getDay()] + ", " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + " Uhr";
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
})();
