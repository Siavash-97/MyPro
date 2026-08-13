/*
  Step 9b: Web Bluetooth – Smartwatch-Herzfrequenz (live-tracking.html).
  Verbindet sich ueber die Web Bluetooth API mit einem Heart Rate Sensor
  (z.B. Brustgurt, Smartwatch). Liest die Herzfrequenz live aus und
  aktualisiert die BPM-Anzeige. Speichert die Werte zusammen mit den
  GPS-Punkten in run_points.heart_rate_bpm.

  Service: Heart Rate Service (UUID 0x180D)
  Characteristic: Heart Rate Measurement (UUID 0x2A37)

  Fehlerbehandlung:
  - Kein Bluetooth verfuegbar → Kachel zeigt "--" + Hinweis
  - Geraet nicht gefunden → Kachel zeigt Fehlermeldung
  - Verbindung getrennt → automatischer Reconnect-Versuch
  - Keine Daten → niemals Fake-Daten, nur Fehlerstatus

  DSGVO: Herzfrequenz ist ein biometrisches Art. 9 Datum.
  Zugriff nur mit bestehender art9_consents-Einwilligung.
*/
(() => {
  "use strict";

  var HR_SERVICE = 0x180D;
  var HR_MEASUREMENT = 0x2A37;
  var MAX_RECONNECT = 3;

  var device = null;
  var characteristic = null;
  var reconnectAttempts = 0;
  var lastHeartRate = null;
  var hrHistory = [];

  document.addEventListener("supabase-ready", function () {
    var M = window.MyProSole;
    if (!M || M.offline) return;

    var page = location.pathname.split("/").pop() || "index.html";
    if (page !== "live-tracking.html") return;

    initBluetoothUI();
  });

  function initBluetoothUI() {
    var bpmValue = document.querySelector("[data-bt-bpm]");
    var bpmLabel = document.querySelector("[data-bt-label]");
    var connectBtn = document.querySelector("[data-bt-connect]");

    if (!bpmValue) return;

    if (!navigator.bluetooth) {
      bpmValue.textContent = "--";
      if (bpmLabel) bpmLabel.textContent = "bpm (nicht verfügbar)";
      if (connectBtn) connectBtn.style.display = "none";
      return;
    }

    bpmValue.textContent = "--";
    if (bpmLabel) bpmLabel.textContent = "bpm";

    if (connectBtn) {
      connectBtn.addEventListener("click", function (e) {
        e.preventDefault();
        requestDevice(bpmValue, bpmLabel, connectBtn);
      });
    }

    window.MyProSole.bluetooth = {
      getLastHeartRate: function () { return lastHeartRate; },
      getHistory: function () { return hrHistory.slice(); },
      getAvgHeartRate: function () {
        if (hrHistory.length === 0) return null;
        var sum = 0;
        for (var i = 0; i < hrHistory.length; i++) sum += hrHistory[i];
        return Math.round(sum / hrHistory.length);
      },
      getMaxHeartRate: function () {
        if (hrHistory.length === 0) return null;
        var max = 0;
        for (var i = 0; i < hrHistory.length; i++) {
          if (hrHistory[i] > max) max = hrHistory[i];
        }
        return max;
      },
      disconnect: disconnectDevice
    };
  }

  async function requestDevice(bpmEl, labelEl, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = "Suche…";
    }

    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [HR_SERVICE]
      });

      device.addEventListener("gattserverdisconnected", function () {
        onDisconnect(bpmEl, labelEl, btnEl);
      });

      await connectDevice(bpmEl, labelEl, btnEl);

    } catch (err) {
      device = null;

      if (err.name === "NotFoundError") {
        bpmEl.textContent = "--";
        if (labelEl) labelEl.textContent = "Kein Gerät gefunden";
      } else if (err.name === "SecurityError") {
        bpmEl.textContent = "--";
        if (labelEl) labelEl.textContent = "Zugriff verweigert";
      } else if (err.name === "NotAllowedError") {
        bpmEl.textContent = "--";
        if (labelEl) labelEl.textContent = "Abgebrochen";
      } else {
        bpmEl.textContent = "--";
        if (labelEl) labelEl.textContent = "Fehler: " + (err.message || "unbekannt");
      }

      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = "Verbinden";
      }
    }
  }

  async function connectDevice(bpmEl, labelEl, btnEl) {
    if (!device || !device.gatt) {
      bpmEl.textContent = "--";
      if (labelEl) labelEl.textContent = "Gerät nicht kompatibel";
      return;
    }

    try {
      var server = await device.gatt.connect();
      var service = await server.getPrimaryService(HR_SERVICE);
      characteristic = await service.getCharacteristic(HR_MEASUREMENT);

      characteristic.addEventListener("characteristicvaluechanged", function (e) {
        onHeartRateChange(e, bpmEl, labelEl);
      });

      await characteristic.startNotifications();
      reconnectAttempts = 0;

      if (btnEl) {
        btnEl.textContent = "Trennen";
        btnEl.disabled = false;
        btnEl.onclick = function (e) {
          e.preventDefault();
          disconnectDevice();
          bpmEl.textContent = "--";
          if (labelEl) labelEl.textContent = "bpm";
          btnEl.textContent = "Verbinden";
          btnEl.onclick = function (e2) {
            e2.preventDefault();
            requestDevice(bpmEl, labelEl, btnEl);
          };
        };
      }

      if (labelEl) labelEl.textContent = "bpm (" + (device.name || "Gerät") + ")";

    } catch (err) {
      bpmEl.textContent = "--";
      if (labelEl) labelEl.textContent = "Verbindungsfehler";

      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = "Erneut verbinden";
      }
    }
  }

  function onHeartRateChange(event, bpmEl, labelEl) {
    var value = event.target.value;
    if (!value) return;

    var flags = value.getUint8(0);
    var hr;

    if (flags & 0x01) {
      hr = value.getUint16(1, true);
    } else {
      hr = value.getUint8(1);
    }

    if (hr < 30 || hr > 250) return;

    lastHeartRate = hr;
    hrHistory.push(hr);

    if (hrHistory.length > 7200) {
      hrHistory = hrHistory.slice(-3600);
    }

    if (bpmEl) {
      bpmEl.textContent = String(hr);
      bpmEl.classList.remove("md-live-stat__value--no-data");
    }
  }

  function onDisconnect(bpmEl, labelEl, btnEl) {
    characteristic = null;

    if (reconnectAttempts < MAX_RECONNECT && device) {
      reconnectAttempts++;
      bpmEl.textContent = "--";
      if (labelEl) labelEl.textContent = "Verbindung verloren… (" + reconnectAttempts + "/" + MAX_RECONNECT + ")";

      setTimeout(function () {
        if (device && device.gatt) {
          connectDevice(bpmEl, labelEl, btnEl);
        }
      }, 2000 * reconnectAttempts);
    } else {
      bpmEl.textContent = "--";
      if (labelEl) labelEl.textContent = "Verbindung getrennt";

      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = "Erneut verbinden";
        btnEl.onclick = function (e) {
          e.preventDefault();
          reconnectAttempts = 0;
          requestDevice(bpmEl, labelEl, btnEl);
        };
      }
    }
  }

  function disconnectDevice() {
    if (characteristic) {
      try { characteristic.stopNotifications(); } catch (_) {}
      characteristic = null;
    }
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    device = null;
    lastHeartRate = null;
    reconnectAttempts = 0;
  }
})();
