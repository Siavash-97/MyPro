(() => {
  "use strict";

  const PROFILE_PENDING_KEY = "myprosole.prototype.profile-pending";
  const HOME_REMINDER_DISMISSED_KEY =
    "myprosole.prototype.home-profile-reminder-dismissed";

  const readSessionFlag = (key) => {
    try {
      return window.sessionStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };

  const writeSessionFlag = (key, value) => {
    try {
      if (value) {
        window.sessionStorage.setItem(key, "true");
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Der statische Prototyp funktioniert auch ohne verfügbaren Web-Speicher.
    }
  };

  const markProfilePending = () => {
    writeSessionFlag(PROFILE_PENDING_KEY, true);
    writeSessionFlag(HOME_REMINDER_DISMISSED_KEY, false);
  };

  const markProfileComplete = () => {
    writeSessionFlag(PROFILE_PENDING_KEY, false);
    writeSessionFlag(HOME_REMINDER_DISMISSED_KEY, false);
  };

  document.querySelectorAll("[data-profile-pending]").forEach((element) => {
    const eventName = element.tagName === "FORM" ? "submit" : "click";
    element.addEventListener(eventName, markProfilePending);
  });

  document.querySelectorAll("[data-profile-complete]").forEach((element) => {
    const eventName = element.tagName === "FORM" ? "submit" : "click";
    element.addEventListener(eventName, markProfileComplete);
  });

  document.querySelectorAll("[data-profile-skip]").forEach((element) => {
    element.addEventListener("click", () => {
      writeSessionFlag(PROFILE_PENDING_KEY, true);
      writeSessionFlag(HOME_REMINDER_DISMISSED_KEY, true);
    });
  });

  document.querySelectorAll("[data-profile-reminder-dismiss]").forEach((element) => {
    element.addEventListener("click", () => {
      writeSessionFlag(HOME_REMINDER_DISMISSED_KEY, true);
    });
  });

  if (window.location.hash === "#profil-hinweis") {
    markProfilePending();
  }

  const profileIsPending = readSessionFlag(PROFILE_PENDING_KEY);
  const homeReminderWasDismissed = readSessionFlag(
    HOME_REMINDER_DISMISSED_KEY,
  );

  document.querySelectorAll('[data-profile-reminder="home"]').forEach((element) => {
    if (profileIsPending && !homeReminderWasDismissed) {
      element.classList.add("md-profile-reminder--visible");
    }
  });

  document.querySelectorAll('[data-profile-reminder="profile"]').forEach((element) => {
    if (profileIsPending) {
      element.classList.add("md-profile-reminder--visible");
    }
  });
})();
