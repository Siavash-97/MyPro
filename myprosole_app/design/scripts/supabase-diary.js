/*
  Step 6: Trainingstagebuch (trainingstagebuch.html) – Lesen und Schreiben.
  Speichert Eintraege in training_diary_entries und training_diary_pain_locations.
  Laedt vorherige Eintraege fuer "Letzte Eintraege".
*/
(() => {
  "use strict";

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var page = location.pathname.split("/").pop() || "index.html";
    if (page !== "trainingstagebuch.html") return;

    var sb = M.db;
    var uid = M.user.id;

    await loadRecentEntries(sb, uid);
    setupDiaryForm(sb, uid);
  });

  var FEELING_DE = { gut: "Gut", okay: "Ging so", schwer: "Schwer" };

  async function loadRecentEntries(sb, uid) {
    var res = await sb.from("training_diary_entries")
      .select("id, entry_date, distance_km, duration_minutes, feeling")
      .eq("user_id", uid)
      .order("entry_date", { ascending: false })
      .limit(5);

    var entries = res.data || [];
    var list = document.querySelector(".md-week-plan");
    if (!list) return;

    var items = list.querySelectorAll("li");
    for (var i = 0; i < items.length; i++) items[i].remove();

    if (entries.length === 0) {
      var p = document.createElement("p");
      p.style.font = "var(--type-body-md)";
      p.style.color = "var(--md-on-surface-variant)";
      p.textContent = "Noch keine Einträge vorhanden.";
      list.parentElement.appendChild(p);
      return;
    }

    var TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      var d = new Date(e.entry_date + "T00:00:00");
      var km = e.distance_km ? parseFloat(e.distance_km).toFixed(1).replace(".", ",") : "--";
      var dur = e.duration_minutes ? fmtMin(parseFloat(e.duration_minutes)) : "--";
      var feel = e.feeling ? FEELING_DE[e.feeling] || e.feeling : "";

      var li = document.createElement("li");
      li.innerHTML =
        '<a class="md-week-plan__day md-week-plan__day--done" href="lauf-zusammenfassung.html" style="text-decoration:none; color:inherit;">' +
          '<span class="md-week-plan__label">' + TAGE[d.getDay()] + '</span>' +
          '<span class="md-week-plan__unit">' + km + ' km · ' + dur + ' min' + (feel ? '<small>' + esc(feel) + '</small>' : '') + '</span>' +
          '<svg class="icon md-row__chevron" aria-hidden="true"><use href="#icon-chevron-right"/></svg>' +
        '</a>';
      list.appendChild(li);
    }
  }

  function setupDiaryForm(sb, uid) {
    var form = document.querySelector(".md-diary");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Speichern…"; }

      var feeling = getRadio(form, "gefuehl");
      var hasPain = getRadio(form, "schmerz") === "ja";

      var distEl = form.querySelector(".md-metric__value");
      var distText = distEl ? distEl.textContent : "";
      var distMatch = distText.match(/([\d,]+)/);
      var distKm = distMatch ? parseFloat(distMatch[1].replace(",", ".")) : null;

      var durText = "";
      var durEls = form.querySelectorAll(".md-metric__value");
      if (durEls.length >= 2) durText = durEls[1].textContent;
      var durMatch = durText.match(/([\d]+):([\d]+)/);
      var durMin = durMatch ? parseInt(durMatch[1], 10) + parseInt(durMatch[2], 10) / 60 : null;

      var paceEl = durEls.length >= 3 ? durEls[2] : null;
      var paceText = paceEl ? paceEl.textContent.trim() : null;

      var painKmEl = form.querySelector("#schmerz-km");
      var painKm = (hasPain && painKmEl && painKmEl.value) ? parseFloat(painKmEl.value) : null;

      var painDescEl = form.querySelector("#schmerz-text");
      var painDesc = (hasPain && painDescEl && painDescEl.value) ? painDescEl.value.trim().substring(0, 120) : null;

      var today = new Date();
      var dateStr = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());

      var params = new URLSearchParams(location.search);
      var linkedRunId = params.get("run_id") || null;

      var entry = {
        user_id: uid,
        entry_date: dateStr,
        run_id: linkedRunId,
        distance_km: distKm,
        duration_minutes: durMin ? Math.round(durMin * 10) / 10 : null,
        pace: paceText,
        feeling: feeling || null,
        has_pain: hasPain,
        pain_onset_km: painKm,
        pain_description: painDesc
      };

      var result = await sb.from("training_diary_entries").insert(entry).select("id").single();

      if (result.error) {
        if (btn) { btn.disabled = false; btn.textContent = "Eintrag speichern"; }
        showSnackbar("Fehler beim Speichern. Bitte versuche es erneut.");
        return;
      }

      if (hasPain && result.data) {
        var locations = getChecked(form, "ort");
        var locationMap = {
          knie: "knie", wade: "wade", achillessehne: "achillessehne",
          schienbein: "schienbein", huefte: "huefte", fuss: "fuss",
          ruecken: "ruecken", anderes: "sonstiges"
        };

        var painRows = [];
        for (var i = 0; i < locations.length; i++) {
          var mapped = locationMap[locations[i]] || "sonstiges";
          painRows.push({ diary_entry_id: result.data.id, location: mapped });
        }
        if (painRows.length > 0) {
          await sb.from("training_diary_pain_locations").insert(painRows);
        }
      }

      showSnackbar("Eintrag gespeichert!");
      setTimeout(function () { location.href = "uebungen.html"; }, 1200);
    });
  }

  function getRadio(form, name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  function getChecked(form, name) {
    var boxes = form.querySelectorAll('input[name="' + name + '"]:checked');
    var vals = [];
    for (var i = 0; i < boxes.length; i++) vals.push(boxes[i].value);
    return vals;
  }

  function fmtMin(m) {
    var min = Math.floor(m);
    var sec = Math.round((m - min) * 60);
    return min + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  var snackbarEl = null;
  var snackbarTimer = 0;
  function showSnackbar(text) {
    if (!snackbarEl) {
      snackbarEl = document.createElement("p");
      snackbarEl.className = "md-snackbar";
      snackbarEl.setAttribute("role", "status");
      document.body.appendChild(snackbarEl);
    }
    snackbarEl.textContent = text;
    snackbarEl.classList.add("md-snackbar--visible");
    clearTimeout(snackbarTimer);
    snackbarTimer = setTimeout(function () {
      snackbarEl.classList.remove("md-snackbar--visible");
    }, 3500);
  }
})();
