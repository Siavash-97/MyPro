/*
  Step 9: Profil (profil.html) – Lesen und anzeigen.
  Laedt Profildaten aus der profiles-Tabelle und zeigt sie im Profil-Header.
  Zeigt den echten Nutzernamen und die E-Mail-Adresse an.
*/
(() => {
  "use strict";

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var page = location.pathname.split("/").pop() || "index.html";
    if (page !== "profil.html") return;

    var sb = M.db;
    var uid = M.user.id;

    await fillProfile(sb, uid);
  });

  async function fillProfile(sb, uid) {
    var res = await sb.from("profiles")
      .select("display_name, running_level, weekly_goal_km, avatar_url")
      .eq("id", uid)
      .single();

    if (!res.data) return;

    var profile = res.data;
    var user = window.MyProSole.user;

    var nameEl = document.querySelector(".md-profile-header__name");
    if (nameEl) nameEl.textContent = profile.display_name || "Dein Profil";

    var metaEl = document.querySelector(".md-profile-header__meta");
    if (metaEl && user.email) metaEl.textContent = user.email;

    var avatar = document.querySelector(".md-avatar");
    if (avatar && profile.avatar_url) {
      avatar.innerHTML = '<img src="' + esc(profile.avatar_url) + '" alt="Profilbild" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">';
    }

    var level = profile.running_level;
    if (level) {
      var levelDe = { anfaenger: "Anfänger", fortgeschritten: "Fortgeschritten", erfahren: "Erfahren" };
      var planDesc = document.querySelector(".md-plan-card__desc");
      if (planDesc) {
        var goalStr = profile.weekly_goal_km ? Math.round(profile.weekly_goal_km) + " km/Woche" : "";
        var parts = [levelDe[level] || level];
        if (goalStr) parts.push(goalStr);
        planDesc.textContent = parts.join(" · ");
      }
    }
  }

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
