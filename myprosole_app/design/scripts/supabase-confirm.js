/*
  E-Mail-Bestaetigungslogik.

  Zwei Wege:
  1. OTP-Code: Benutzer gibt den 6-stelligen Code aus der E-Mail ein
  2. Magic-Link: Supabase leitet mit token_hash + type in der URL hierher
*/
(() => {
  "use strict";

  var email = "";

  document.addEventListener("supabase-ready", function () {
    var sb = window.MyProSole && window.MyProSole.db;
    if (!sb) return;

    email = sessionStorage.getItem("mps_confirm_email") || "";

    var display = document.getElementById("confirm-email-display");
    if (display && email) {
      display.textContent = email;
    }

    handleMagicLink(sb);
    setupOtpInputs();
    setupConfirmForm(sb);
    setupResend(sb);
  });

  function handleMagicLink(sb) {
    var hash = window.location.hash;
    if (!hash) return;

    var params = new URLSearchParams(hash.substring(1));
    var accessToken = params.get("access_token");
    var refreshToken = params.get("refresh_token");
    var type = params.get("type");

    if (accessToken && type === "signup") {
      sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(function (result) {
        if (!result.error) {
          showSuccess();
          sessionStorage.removeItem("mps_confirm_email");
          setTimeout(function () { location.href = "anamnese.html"; }, 1500);
        }
      });
    }
  }

  function setupOtpInputs() {
    var container = document.getElementById("otp-inputs");
    if (!container) return;
    var inputs = container.querySelectorAll("input");

    inputs.forEach(function (input, i) {
      input.addEventListener("input", function () {
        var val = input.value.replace(/[^0-9]/g, "");
        input.value = val;

        if (val) {
          input.classList.add("filled");
          if (i < inputs.length - 1) {
            inputs[i + 1].focus();
          }
        } else {
          input.classList.remove("filled");
        }
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !input.value && i > 0) {
          inputs[i - 1].focus();
          inputs[i - 1].value = "";
          inputs[i - 1].classList.remove("filled");
        }
      });

      input.addEventListener("paste", function (e) {
        e.preventDefault();
        var pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
        for (var j = 0; j < inputs.length && j < pasted.length; j++) {
          inputs[j].value = pasted[j];
          inputs[j].classList.add("filled");
        }
        var last = Math.min(pasted.length, inputs.length) - 1;
        if (last >= 0) inputs[last].focus();
      });
    });
  }

  function getOtpValue() {
    var inputs = document.querySelectorAll("#otp-inputs input");
    var code = "";
    inputs.forEach(function (input) { code += input.value; });
    return code;
  }

  function setupConfirmForm(sb) {
    var form = document.getElementById("confirm-form");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      var code = getOtpValue();
      if (code.length < 6) {
        showMsg(form, "Bitte gib alle 6 Ziffern ein.", true);
        return;
      }

      if (!email) {
        showMsg(form, "E-Mail-Adresse fehlt. Bitte registriere dich erneut.", true);
        return;
      }

      var btn = document.getElementById("confirm-btn");
      btn.disabled = true;
      btn.textContent = "Wird geprüft…";
      clearMsg(form);

      var result = await sb.auth.verifyOtp({
        email: email,
        token: code,
        type: "signup"
      });

      if (result.error) {
        var msg = "Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.";
        showMsg(form, msg, true);
        btn.disabled = false;
        btn.textContent = "Bestätigen";
        return;
      }

      showSuccess();
      sessionStorage.removeItem("mps_confirm_email");
      setTimeout(function () { location.href = "anamnese.html"; }, 1500);
    });
  }

  function setupResend(sb) {
    var link = document.getElementById("resend-link");
    if (!link) return;

    link.addEventListener("click", async function (e) {
      e.preventDefault();
      if (!email) return;

      link.setAttribute("disabled", "");
      link.textContent = "Wird gesendet…";

      await sb.auth.resend({ type: "signup", email: email });

      link.textContent = "Code erneut gesendet!";

      setTimeout(function () {
        link.removeAttribute("disabled");
        link.textContent = "Code erneut senden";
      }, 30000);
    });
  }

  function showSuccess() {
    var form = document.getElementById("confirm-form");
    var success = document.getElementById("confirm-success");
    if (form) form.style.display = "none";
    if (success) success.style.display = "block";
  }

  function showMsg(form, text, isError) {
    clearMsg(form);
    var p = document.createElement("p");
    p.className = "supabase-msg";
    p.textContent = text;
    p.style.color = isError ? "var(--md-error)" : "var(--md-primary)";
    p.style.font = "var(--type-body-md)";
    p.style.margin = "0";
    p.style.textAlign = "center";
    p.style.padding = "8px 0";
    var btn = document.getElementById("confirm-btn");
    if (btn) btn.parentNode.insertBefore(p, btn);
  }

  function clearMsg(form) {
    var msgs = form.querySelectorAll(".supabase-msg");
    for (var i = 0; i < msgs.length; i++) msgs[i].remove();
  }
})();
