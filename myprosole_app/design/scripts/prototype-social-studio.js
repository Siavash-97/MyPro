(() => {
  "use strict";

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  const ALLOWED_STYLES = new Set(["dynamic", "clean", "motivational"]);
  const ALLOWED_ORIGINS = new Set(["analysis", "summary"]);
  const ALLOWED_ANALYSIS_MODES = new Set(["gps", "insole"]);

  const photoInput = document.querySelector("[data-social-photo]");
  const uploadStatus = document.querySelector("[data-social-upload-status]");
  const stylePicker = document.querySelector("[data-social-style-picker]");
  const generateLink = document.querySelector("[data-social-generate]");
  const chat = document.querySelector("[data-social-chat]");
  const messageForm = document.querySelector("[data-social-message-form]");
  const messageInput = document.querySelector("[data-social-message]");
  const backLink = document.querySelector("[data-social-back]");
  let activePreviewUrl = null;

  const params = new URLSearchParams(window.location.search);
  const requestedOrigin = params.get("from");
  const origin = ALLOWED_ORIGINS.has(requestedOrigin)
    ? requestedOrigin
    : "analysis";
  const requestedMode = params.get("mode");
  const analysisMode = ALLOWED_ANALYSIS_MODES.has(requestedMode)
    ? requestedMode
    : "gps";
  const studioQuery =
    origin === "summary"
      ? "from=summary"
      : `from=analysis&mode=${analysisMode}`;

  if (backLink) {
    backLink.href =
      origin === "summary"
        ? "lauf-zusammenfassung.html"
        : `analyse-ergebnis.html?mode=${analysisMode}`;
  }
  if (generateLink) {
    generateLink.href = `share-export.html?source=ai&${studioQuery}`;
  }

  const addBubble = (text, role, imageUrl = null) => {
    if (!chat) {
      return;
    }
    const bubble = document.createElement("div");
    bubble.className = `md-chat-bubble md-chat-bubble--${role}`;
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "md-social-chat__photo";
      image.src = imageUrl;
      image.alt = "Lokal ausgewähltes Laufbild";
      bubble.append(image);
    }
    const copy = document.createElement("p");
    copy.textContent = text;
    bubble.append(copy);
    chat.append(bubble);
  };

  const rejectPhoto = (message) => {
    if (uploadStatus) {
      uploadStatus.textContent = message;
      uploadStatus.dataset.state = "error";
    }
    if (stylePicker) {
      stylePicker.hidden = true;
    }
    if (generateLink) {
      generateLink.hidden = true;
    }
  };

  photoInput?.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      rejectPhoto("Bitte wähle ein Bild aus.");
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      rejectPhoto("Dieses Dateiformat wird nicht unterstützt.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      rejectPhoto("Das Bild ist größer als 10 MB.");
      return;
    }

    if (activePreviewUrl) {
      URL.revokeObjectURL(activePreviewUrl);
    }
    activePreviewUrl = URL.createObjectURL(file);
    if (uploadStatus) {
      uploadStatus.textContent = "Bild lokal ausgewählt.";
      uploadStatus.dataset.state = "success";
    }
    addBubble("Dieses Foto möchte ich verwenden.", "user", activePreviewUrl);
    addBubble("Sieht gut aus. Wähle jetzt einen Stil oder beschreibe deinen Wunsch.", "agent");
    if (stylePicker) {
      stylePicker.hidden = false;
    }
  });

  document.querySelectorAll("[data-social-style]").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedStyle = button.dataset.socialStyle;
      if (!ALLOWED_STYLES.has(selectedStyle)) {
        return;
      }
      document.querySelectorAll("[data-social-style]").forEach((item) => {
        item.classList.toggle("md-filter-chip--active", item === button);
      });
      addBubble(
        `Stil ausgewählt: ${button.textContent.trim()}. Ich kombiniere ihn mit deinen Laufdaten.`,
        "agent",
      );
      if (generateLink) {
        generateLink.hidden = false;
      }
    });
  });

  messageForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = messageInput?.value.trim() ?? "";
    if (!message) {
      return;
    }
    addBubble(message, "user");
    addBubble("Verstanden. Ich berücksichtige das beim Entwurf.", "agent");
    messageInput.value = "";
  });

})();
