/*
  Step 7: Anamnese (anamnese.html) – Speichert Antworten in Supabase.
  Erzeugt DSGVO Art. 9 Einwilligung, anamnese_session und anamnese_answers.
  Greift in den bestehenden Prototyp-Fluss ein, indem es beim Abschluss
  die gesammelten Antworten persistiert.
*/
(() => {
  "use strict";

  document.addEventListener("supabase-ready", async function () {
    var M = window.MyProSole;
    if (!M || M.offline || !M.db || !M.user) return;

    var page = location.pathname.split("/").pop() || "index.html";
    if (page !== "anamnese.html") return;

    var sb = M.db;
    var uid = M.user.id;

    setupAnamnese(sb, uid);
  });

  function setupAnamnese(sb, uid) {
    var collected = {};

    document.addEventListener("change", function (e) {
      var input = e.target;
      if (!input.name) return;

      if (input.type === "radio") {
        collected[input.name] = input.value;
      } else if (input.type === "checkbox") {
        if (!collected[input.name]) collected[input.name] = [];
        if (input.checked) {
          if (collected[input.name].indexOf(input.value) === -1)
            collected[input.name].push(input.value);
        } else {
          collected[input.name] = collected[input.name].filter(function (v) { return v !== input.value; });
        }
      }
    });

    document.addEventListener("input", function (e) {
      var input = e.target;
      if (input.hasAttribute("data-anamnese-eingabe") && input.name) {
        collected[input.name] = input.value;
      }
    });

    var steppers = document.querySelectorAll("[data-anamnese-stepper]");
    for (var i = 0; i < steppers.length; i++) {
      (function (stepper) {
        var output = stepper.querySelector("output");
        if (output && output.name) {
          collected[output.name] = output.textContent.trim();
          var observer = new MutationObserver(function () {
            collected[output.name] = output.textContent.trim();
          });
          observer.observe(output, { childList: true, characterData: true, subtree: true });
        }
      })(steppers[i]);
    }

    var abschlussLinks = document.querySelectorAll("[data-anamnese-abschluss]");
    for (var j = 0; j < abschlussLinks.length; j++) {
      abschlussLinks[j].addEventListener("click", function (e) {
        e.preventDefault();
        saveAnamnese(sb, uid, collected);
      });
    }
  }

  async function saveAnamnese(sb, uid, answers) {
    var consentRes = await sb.from("art9_consents").insert({
      user_id: uid,
      consent_scope: "anamnese"
    });

    var hasInjuryBlock = answers["schmerzen"] === "ja";
    var block = "a";

    var sessionRes = await sb.from("anamnese_sessions").insert({
      user_id: uid,
      questionnaire_version: 1,
      block: block,
      completed_at: new Date().toISOString()
    }).select("id").single();

    if (sessionRes.error || !sessionRes.data) {
      location.href = "home.html";
      return;
    }

    var sessionId = sessionRes.data.id;
    var rows = [];

    for (var key in answers) {
      if (!answers.hasOwnProperty(key)) continue;
      var val = answers[key];

      if (Array.isArray(val)) {
        for (var k = 0; k < val.length; k++) {
          if (val[k]) rows.push({ session_id: sessionId, question_key: key, answer_value: String(val[k]) });
        }
      } else if (val !== null && val !== undefined && val !== "") {
        rows.push({ session_id: sessionId, question_key: key, answer_value: String(val) });
      }
    }

    if (rows.length > 0) {
      await sb.from("anamnese_answers").insert(rows);
    }

    if (answers["dranbleiben"] || answers["schlaf"]) {
      var bSession = await sb.from("anamnese_sessions").insert({
        user_id: uid,
        questionnaire_version: 1,
        block: "b",
        completed_at: new Date().toISOString()
      }).select("id").single();

      if (bSession.data) {
        var bRows = [];
        if (answers["dranbleiben"]) {
          var dArr = Array.isArray(answers["dranbleiben"]) ? answers["dranbleiben"] : [answers["dranbleiben"]];
          for (var d = 0; d < dArr.length; d++) {
            bRows.push({ session_id: bSession.data.id, question_key: "dranbleiben", answer_value: dArr[d] });
          }
        }
        if (answers["schlaf"]) {
          bRows.push({ session_id: bSession.data.id, question_key: "schlaf", answer_value: answers["schlaf"] });
        }
        if (bRows.length > 0) {
          await sb.from("anamnese_answers").insert(bRows);
        }
      }
    }

    location.href = "home.html";
  }
})();
