/*
  Step 5: Uebungen (uebungen.html) – echte Daten aus der exercises-Tabelle.

  Der Gym-Plan ist mit Migration 0038 weggefallen; sein Entwurf und die
  Funktion, die ihn fuellte, sind mit entfernt.
*/
(() => {
  "use strict";

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var sb = M.db;
    var uid = M.user.id;
    var page = location.pathname.split("/").pop() || "index.html";

    if (page === "uebungen.html") await fillUebungen(sb, uid);
  });

  var CAT_DE = {
    strength: "Kraft",
    technique: "Technik",
    mobility: "Beweglichkeit",
    injury_prevention: "Verletzungsprävention"
  };

  async function fillUebungen(sb, uid) {
    var res = await sb.from("exercises")
      .select("id, name_de, category, difficulty, modality, description_de")
      .eq("is_active", true)
      .order("name_de");

    var exercises = res.data || [];
    var container = findExerciseList();
    if (!container || exercises.length === 0) return;

    var items = container.querySelectorAll(".md-list-item");
    for (var i = 0; i < items.length; i++) items[i].remove();

    for (var j = 0; j < exercises.length; j++) {
      var ex = exercises[j];
      var div = document.createElement("div");
      div.className = "md-list-item";
      div.innerHTML =
        '<div class="md-list-item__thumb"><svg class="icon-sm"><use href="#icon-play"/></svg></div>' +
        '<div class="md-list-item__body">' +
          '<p class="md-list-item__title">' + esc(ex.name_de) + '</p>' +
          '<p class="md-list-item__meta">' + (CAT_DE[ex.category] || ex.category) + ' · ' + esc(ex.difficulty) + '</p>' +
        '</div>' +
        '<svg class="icon md-row__chevron"><use href="#icon-chevron-right"/></svg>';
      container.appendChild(div);
    }

    var weekStart = mondayOfWeek();
    var wlRes = await sb.from("workout_logs")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "completed")
      .gte("started_at", weekStart.toISOString());

    var done = (wlRes.data || []).length;
    var weekCount = document.querySelector('.md-card[aria-labelledby="woche-titel"] .md-row span');
    if (weekCount) weekCount.textContent = done + " von 4 Einheiten";

    var weekBar = document.querySelector('.md-card[aria-labelledby="woche-titel"] .md-progress__fill');
    if (weekBar) weekBar.style.width = Math.min(100, Math.round((done / 4) * 100)) + "%";
  }

  function findExerciseList() {
    var titles = document.querySelectorAll(".md-section-title");
    for (var i = 0; i < titles.length; i++) {
      if (titles[i].textContent.trim() === "Alle Übungen") {
        return titles[i].parentElement;
      }
    }
    return null;
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

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
