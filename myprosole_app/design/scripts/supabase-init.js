/*
  Supabase-Anbindung fuer den statischen Mockup-Prototyp.

  Laedt die Supabase-JS-Bibliothek vom CDN, initialisiert den Client,
  schuetzt nicht-oeffentliche Seiten (Session-Guard) und verdrahtet
  Login-, Registrierungs- und Abmelde-Formulare.

  Hinweis zum Anon-Key: Der Supabase-Anon-Key ist ein oeffentlicher
  Client-Schluessel, der fuer die Verwendung im Browser vorgesehen ist.
  Die Sicherheit wird durch Row Level Security (RLS) auf der Datenbank
  gewaehrleistet, nicht durch Geheimhaltung dieses Schluessels. In einem
  statischen HTML-Projekt ohne Build-Prozess gibt es keinen Mechanismus,
  um den Key aus dem Quelltext herauszuhalten. Dies ist eine dokumentierte
  Abweichung von der Regel "keine API-Keys im Code" (DEVELOPMENT_STANDARDS.md).
*/
(() => {
  "use strict";

  var SUPABASE_URL = "https://pssyomphfjvhnnuljtzh.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzc3lvbXBoZmp2aG5udWxqdHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDc0NzUsImV4cCI6MjEwMjE4MzQ3NX0.ecbCXVCV5KmNguphOcAY2IADrTO3D6u3UgAFg1ziSx0";

  var PUBLIC_PAGES = ["welcome.html", "login.html", "register.html", "confirm-email.html", "index.html"];

  window.MyProSole = window.MyProSole || {};

  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.9";
  s.onload = start;
  s.onerror = function () {
    window.MyProSole.offline = true;
    var name = page();
    if (PUBLIC_PAGES.indexOf(name) === -1) {
      location.replace("welcome.html");
      return;
    }
    document.dispatchEvent(new Event("supabase-ready"));
  };
  document.head.appendChild(s);

  function page() {
    return location.pathname.split("/").pop() || "index.html";
  }

  async function start() {
    if (!window.supabase || !window.supabase.createClient) return;

    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.MyProSole.db = sb;

    var name = page();
    var isPublic = PUBLIC_PAGES.indexOf(name) !== -1;

    var res = await sb.auth.getSession();
    var session = res.data.session;

    if (!isPublic && !session) {
      location.replace("welcome.html");
      return;
    }

    if (session && (name === "welcome.html" || name === "login.html" || name === "register.html")) {
      location.replace("home.html");
      return;
    }

    if (session) {
      window.MyProSole.user = session.user;
      window.MyProSole.session = session;
    }

    setupLogin(sb);
    setupRegister(sb);
    setupLogout(sb);
    setupOAuthHint();

    document.dispatchEvent(new Event("supabase-ready"));
  }

  function setupLogin(sb) {
    var form = document.querySelector(".md-auth-form");
    if (!form || !form.querySelector("#login-email")) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var email = form.querySelector("#login-email").value.trim();
      var pw = form.querySelector("#login-password").value;
      var btn = form.querySelector('button[type="submit"]');

      clearMsg(form);
      btn.disabled = true;
      btn.textContent = "Anmelden…";

      var result = await sb.auth.signInWithPassword({ email: email, password: pw });

      if (result.error) {
        showMsg(form, "E-Mail oder Passwort ist falsch.", true);
        btn.disabled = false;
        btn.textContent = "Anmelden";
        return;
      }

      location.href = "home.html";
    });
  }

  function setupRegister(sb) {
    var form = document.querySelector(".md-auth-form");
    if (!form || !form.querySelector("#register-email")) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.querySelector("#register-name").value.trim();
      var email = form.querySelector("#register-email").value.trim();
      var pw = form.querySelector("#register-password").value;
      var consent = form.querySelector("#register-consent");
      var btn = form.querySelector('button[type="submit"]');

      clearMsg(form);

      if (consent && !consent.checked) {
        showMsg(form, "Bitte akzeptiere die AGB und Datenschutzerklärung.", true);
        return;
      }

      btn.disabled = true;
      btn.textContent = "Registrieren…";

      var result = await sb.auth.signUp({
        email: email,
        password: pw,
        options: { data: { full_name: name } }
      });

      if (result.error) {
        var msg = "Registrierung fehlgeschlagen. Bitte versuche es erneut.";
        if (result.error.message && result.error.message.indexOf("already registered") !== -1) {
          msg = "Diese E-Mail ist bereits registriert. Bitte melde dich an.";
        }
        showMsg(form, msg, true);
        btn.disabled = false;
        btn.textContent = "Registrieren";
        return;
      }

      if (result.data.user && !result.data.session) {
        sessionStorage.setItem("mps_confirm_email", email);
        location.href = "confirm-email.html";
        return;
      }

      location.href = "anamnese.html";
    });
  }

  function setupLogout(sb) {
    var icon = document.querySelector('use[href="#icon-logout"]');
    if (!icon) return;
    var link = icon.closest("a");
    if (!link) return;

    link.addEventListener("click", async function (e) {
      e.preventDefault();
      await sb.auth.signOut();
      location.href = "welcome.html";
    });
  }

  function setupOAuthHint() {
    var providers = document.querySelectorAll("[data-auth-provider]");
    providers.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        snackbar("Google- und Facebook-Login wird bald verfügbar. Bitte nutze E-Mail.");
      });
    });
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
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.parentNode.insertBefore(p, btn);
  }

  function clearMsg(form) {
    var msgs = form.querySelectorAll(".supabase-msg");
    for (var i = 0; i < msgs.length; i++) msgs[i].remove();
  }

  var snackbarEl = null;
  var snackbarTimer = 0;
  function snackbar(text) {
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
