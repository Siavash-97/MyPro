/*
  Step 5: Uebungen (uebungen.html) + Gym-Plan (gym-plan.html) – echte Daten.
  Laedt Uebungen aus der exercises-Tabelle und Gym-Plaene aus gym_plans +
  gym_plan_exercises.
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
    if (page === "gym-plan.html") await fillGymPlan(sb, uid);
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

  async function fillGymPlan(sb, uid) {
    var plans = await sb.from("gym_plans")
      .select("id, name, is_active")
      .eq("user_id", uid)
      .eq("is_active", true)
      .order("created_at");

    var planList = plans.data || [];

    if (planList.length === 0) return;

    var sections = document.querySelectorAll("details.md-analysis-section");
    for (var s = 0; s < sections.length; s++) sections[s].remove();

    var parent = document.querySelector("section[aria-labelledby='plaene-titel']");
    if (!parent) return;

    var addBtn = parent.querySelector("a.md-button--text:last-of-type");

    for (var p = 0; p < planList.length; p++) {
      var plan = planList[p];

      var exRes = await sb.from("gym_plan_exercises")
        .select("id, position, sets, reps, duration_seconds, notes, exercise_id, exercises(name_de)")
        .eq("gym_plan_id", plan.id)
        .order("position");

      var exercises = exRes.data || [];

      var details = document.createElement("details");
      details.className = "md-analysis-section";
      if (p === 0) details.setAttribute("open", "");
      details.style.marginBottom = "var(--space-sm)";

      var summary = document.createElement("summary");
      summary.innerHTML =
        '<span><strong>' + esc(plan.name) + '</strong><small>' + exercises.length + ' Übungen</small></span>' +
        '<svg class="icon"><use href="#icon-chevron-down"/></svg>';
      details.appendChild(summary);

      var content = document.createElement("div");
      content.className = "md-analysis-section__content";

      var ol = document.createElement("ol");
      ol.className = "md-plan-list";

      for (var e = 0; e < exercises.length; e++) {
        var ex = exercises[e];
        var name = (ex.exercises && ex.exercises.name_de) ? ex.exercises.name_de : "Übung";
        var desc = "";
        if (ex.sets && ex.reps) desc = ex.sets + " Sätze · " + ex.reps + " Wiederholungen";
        else if (ex.sets && ex.duration_seconds) desc = ex.sets + " Sätze · " + ex.duration_seconds + " Sekunden";
        if (ex.notes) desc += (desc ? " · " : "") + ex.notes;

        var li = document.createElement("li");
        li.className = "md-plan-item";
        li.innerHTML =
          '<svg class="icon-sm md-plan-item__grip" aria-hidden="true"><use href="#icon-drag"/></svg>' +
          '<span class="md-plan-item__body">' + esc(name) + '<small>' + esc(desc) + '</small></span>' +
          '<button class="md-plan-item__remove" type="button" aria-label="' + esc(name) + ' entfernen"><svg class="icon-sm"><use href="#icon-remove"/></svg></button>';
        ol.appendChild(li);
      }

      content.appendChild(ol);

      var addEx = document.createElement("a");
      addEx.className = "md-button md-button--text";
      addEx.href = "#";
      addEx.style.width = "100%";
      addEx.innerHTML = '<svg class="icon-sm" aria-hidden="true"><use href="#icon-plus"/></svg> Übung hinzufügen';
      content.appendChild(addEx);

      details.appendChild(content);

      if (addBtn) parent.insertBefore(details, addBtn);
      else parent.appendChild(details);
    }
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
