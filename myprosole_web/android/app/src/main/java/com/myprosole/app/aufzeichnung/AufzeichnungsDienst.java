package com.myprosole.app.aufzeichnung;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.myprosole.app.MainActivity;
import com.myprosole.app.R;

import java.util.Locale;

/**
 * Haelt die Laufaufzeichnung am Leben, wenn der Bildschirm ausgeht oder
 * jemand zu einer anderen App wechselt.
 *
 * Was dieser Dienst tut und was ausdruecklich nicht
 * -------------------------------------------------
 * Er sammelt rohe GPS-Messungen und legt sie ab. Mehr nicht.
 *
 * Keine Bewegungserkennung, keine Streckenrechnung, keine Pace, keine
 * Uebertragung an einen Server. Das alles steht in lib/bewegung.ts und
 * store/run.ts, wo es mit Pruefungen abgesichert ist. Java ohne Emulator ist
 * ein schlechter Ort fuer Fachlogik, und zwei Rechenwege fuer dieselbe Sache
 * waeren zwei Gelegenheiten, verschiedene Ergebnisse zu bekommen.
 *
 * Warum GPS_PROVIDER und nicht der gemischte Anbieter
 * ---------------------------------------------------
 * Der Fused-Anbieter mischt GPS, WLAN, Mobilfunk und Sensoren und leitet die
 * Geschwindigkeit teils ab, statt sie zu messen. Unsere Bewegungserkennung
 * haengt aber genau an der gemessenen Doppler-Geschwindigkeit - dem Wert, den
 * der GNSS-Empfaenger aus der Frequenzverschiebung der Satellitensignale
 * gewinnt. Der rohe Anbieter liefert ihn unvermischt.
 *
 * Nebeneffekt: keine Abhaengigkeit von Google Play Services. Die App laeuft
 * damit auch auf Geraeten ohne Google-Dienste.
 *
 * Preis, offen benannt: kein Rueckfall auf andere Quellen. Kein GPS-Empfang,
 * keine Messung. Fuer Laufaufzeichnung im Freien ist das richtig; der erste
 * Fix unter Baeumen dauert laenger. Die Anzeige sagt das bereits.
 */
public class AufzeichnungsDienst extends Service {

    private static final String MARKE = "MyProSole.Aufzeichnung";

    public static final String AKTION_START = "com.myprosole.app.aufzeichnung.START";
    public static final String AKTION_STOPP = "com.myprosole.app.aufzeichnung.STOPP";
    public static final String EXTRA_LAUF_ID = "laufId";

    /** Muss innerhalb der App eindeutig sein. */
    private static final int BENACHRICHTIGUNG_ID = 4711;
    private static final String KANAL_ID = "aufzeichnung";

    private static final String ABLAGE = "myprosole.aufzeichnung";
    private static final String SCHLUESSEL_LAUF = "laufId";
    private static final String SCHLUESSEL_START = "startZeit";

    /** Eine Messung je Sekunde. Der Empfaenger laeuft ohnehin. */
    private static final long TAKT_MS = 1000L;
    /** Kein Mindestabstand im Funk - aussortiert wird spaeter, in JavaScript. */
    private static final float MINDESTABSTAND_M = 0f;

    /**
     * So oft wird die Benachrichtigung aufgefrischt.
     *
     * Nicht sekuendlich: Jede Auffrischung kostet selbst Strom, und in der
     * Statusleiste sieht niemand den Unterschied. Zehn Sekunden halten die
     * Zeitangabe glaubwuerdig, auch wenn gerade keine Messung hereinkommt.
     */
    private static final long ANZEIGE_TAKT_MS = 10_000L;

    /** Aelter als das, und es gilt als "kein Empfang" statt "GPS aktiv". */
    private static final long EMPFANG_FRISCH_MS = 15_000L;

    private LocationManager ortung;
    private PunkteSpeicher speicher;
    private PowerManager.WakeLock wachhalter;
    private LocationListener zuhoerer;

    private String laufId;
    private long startZeit;
    private long letzteMessungMs = 0L;
    private boolean laeuft = false;

    private final Handler anzeigeTakt = new Handler(Looper.getMainLooper());
    private final Runnable anzeigeAuffrischen = new Runnable() {
        @Override
        public void run() {
            if (!laeuft) return;
            benachrichtigungAuffrischen();
            anzeigeTakt.postDelayed(this, ANZEIGE_TAKT_MS);
        }
    };

    // ---- Von aussen ----------------------------------------------------

    /**
     * Dienst starten.
     *
     * Darf nur aufgerufen werden, wenn die App sichtbar ist UND die
     * Standortberechtigung bereits erteilt wurde. Seit Android 12 verweigert
     * das System den Start eines Standortdienstes aus dem Hintergrund, und
     * seit Android 14 auch dann, wenn die Berechtigung noch aussteht.
     *
     * Der zweite Fall ist der tueckische: Er tritt nur beim allerersten Start
     * auf, wenn der Dienst im selben Zug mit der Berechtigungsanfrage
     * gestartet wird. Nach einem Neustart der App ist die Berechtigung da und
     * der Fehler weg - man sieht ihn im eigenen Test also meist nie.
     */
    public static void starten(Context zusammenhang, String laufId) {
        Intent absicht = new Intent(zusammenhang, AufzeichnungsDienst.class);
        absicht.setAction(AKTION_START);
        absicht.putExtra(EXTRA_LAUF_ID, laufId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            zusammenhang.startForegroundService(absicht);
        } else {
            zusammenhang.startService(absicht);
        }
    }

    public static void stoppen(Context zusammenhang) {
        Intent absicht = new Intent(zusammenhang, AufzeichnungsDienst.class);
        absicht.setAction(AKTION_STOPP);
        zusammenhang.startService(absicht);
    }

    // ---- Lebenszyklus --------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        ortung = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        speicher = PunkteSpeicher.hole(this);
        kanalAnlegen();
    }

    @Override
    public int onStartCommand(Intent absicht, int flaggen, int startKennung) {
        // absicht == null heisst: Android hat den Dienst nach einem
        // Prozesstod neu erzeugt (START_STICKY). Der Zustand im Speicher ist
        // dann weg - deshalb liegt er in den Einstellungen.
        if (absicht == null) {
            String gemerkt = einstellungen().getString(SCHLUESSEL_LAUF, null);
            if (gemerkt == null) {
                Log.i(MARKE, "Neustart ohne gemerkten Lauf - Dienst endet.");
                stopSelf();
                return START_NOT_STICKY;
            }
            Log.i(MARKE, "Neustart nach Prozesstod, Lauf " + gemerkt);
            return aufzeichnungBeginnen(gemerkt, false);
        }

        if (AKTION_STOPP.equals(absicht.getAction())) {
            aufzeichnungBeenden();
            return START_NOT_STICKY;
        }

        String neueId = absicht.getStringExtra(EXTRA_LAUF_ID);
        if (neueId == null) {
            Log.w(MARKE, "Start ohne Laufkennung - abgelehnt.");
            stopSelf();
            return START_NOT_STICKY;
        }
        return aufzeichnungBeginnen(neueId, true);
    }

    /**
     * Kein gebundener Dienst.
     *
     * Das gelesene Fremdwerk bindet sich an die Oberflaeche und beendet sich
     * in onUnbind. Genau daran scheitert es, wenn jemand die App aus der
     * Uebersicht wischt: Die Bindung faellt weg, der Dienst gibt auf, die
     * Aufzeichnung ist tot. Wir wollen das Gegenteil.
     */
    @Override
    public IBinder onBind(Intent absicht) {
        return null;
    }

    @Override
    public void onDestroy() {
        aufzeichnungBeenden();
        super.onDestroy();
    }

    // ---- Aufzeichnung --------------------------------------------------

    private int aufzeichnungBeginnen(String id, boolean neu) {
        this.laufId = id;

        SharedPreferences ablage = einstellungen();
        if (neu || !ablage.contains(SCHLUESSEL_START)) {
            startZeit = System.currentTimeMillis();
            ablage.edit()
                .putString(SCHLUESSEL_LAUF, id)
                .putLong(SCHLUESSEL_START, startZeit)
                .apply();
        } else {
            startZeit = ablage.getLong(SCHLUESSEL_START, System.currentTimeMillis());
        }

        // Vordergrund ZUERST. Android raeumt einen Dienst weg, der nicht
        // binnen weniger Sekunden nach dem Start eine Benachrichtigung zeigt.
        if (!inDenVordergrund()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        wachhalterNehmen();

        if (!ortungAnfordern()) {
            // Kein Recht oder kein Empfaenger: Der Dienst bleibt trotzdem
            // stehen und zeigt es an, statt still zu verschwinden. Sobald die
            // Erlaubnis nachgereicht wird, kann die App ihn neu anstossen.
            Log.w(MARKE, "Ortung konnte nicht angefordert werden.");
        }

        laeuft = true;
        anzeigeTakt.removeCallbacks(anzeigeAuffrischen);
        anzeigeTakt.postDelayed(anzeigeAuffrischen, ANZEIGE_TAKT_MS);

        // START_STICKY: Raeumt Android den Prozess unter Speicherdruck weg,
        // erzeugt es den Dienst spaeter neu - mit absicht == null, siehe
        // oben. Der Dienst darf sich NICHT selbst neu starten; das waere ein
        // Start aus dem Hintergrund und seit Android 12 verboten.
        return START_STICKY;
    }

    private void aufzeichnungBeenden() {
        laeuft = false;
        anzeigeTakt.removeCallbacks(anzeigeAuffrischen);

        if (zuhoerer != null) {
            try {
                ortung.removeUpdates(zuhoerer);
            } catch (Exception e) {
                Log.w(MARKE, "Ortung liess sich nicht abmelden", e);
            }
            zuhoerer = null;
        }

        wachhalterZurueckgeben();

        // Die gemerkte Laufkennung muss weg, sonst wuerde ein Neustart des
        // Dienstes einen laengst beendeten Lauf wieder aufnehmen.
        einstellungen().edit().remove(SCHLUESSEL_LAUF).remove(SCHLUESSEL_START).apply();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private boolean ortungAnfordern() {
        if (!hatOrtungsrecht()) return false;
        if (ortung == null || !ortung.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return false;
        }

        // Ausgeschriebene anonyme Klasse mit ALLEN vier Methoden, ausdruecklich
        // kein Lambda.
        //
        // Ein Lambda erzeugt nur die eine abstrakte Methode. Ruft Android dann
        // onStatusChanged auf - was es unterhalb von API 30 tut -, fliegt ein
        // AbstractMethodError. Genau dieser Absturz ist in einem der gelesenen
        // Fremdwerke in Produktion auf Android 8.1 aufgetreten. Wir
        // unterstuetzen ab Android 7.
        zuhoerer = new LocationListener() {
            @Override
            public void onLocationChanged(Location ort) {
                messungAufnehmen(ort);
            }

            @Override
            public void onStatusChanged(String anbieter, int stand, Bundle zusatz) {
                // Absichtlich leer - aber vorhanden. Siehe oben.
            }

            @Override
            public void onProviderEnabled(String anbieter) {
                Log.i(MARKE, "Anbieter wieder da: " + anbieter);
            }

            @Override
            public void onProviderDisabled(String anbieter) {
                Log.w(MARKE, "Anbieter abgeschaltet: " + anbieter);
                benachrichtigungAuffrischen();
            }
        };

        try {
            ortung.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, TAKT_MS, MINDESTABSTAND_M, zuhoerer
            );
            return true;
        } catch (SecurityException e) {
            Log.e(MARKE, "Keine Erlaubnis fuer die Ortung", e);
            return false;
        } catch (IllegalArgumentException e) {
            Log.e(MARKE, "GPS-Anbieter fehlt auf diesem Geraet", e);
            return false;
        }
    }

    private void messungAufnehmen(Location ort) {
        if (laufId == null) return;
        letzteMessungMs = System.currentTimeMillis();
        speicher.merken(laufId, ort);
    }

    // ---- Benachrichtigung ----------------------------------------------

    private void kanalAnlegen() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel kanal = new NotificationChannel(
            KANAL_ID,
            "Laufaufzeichnung",
            // Niedrig: kein Ton, kein Vibrieren, kein Einblenden ueber
            // anderen Apps. Die Benachrichtigung soll da sein, nicht stoeren.
            NotificationManager.IMPORTANCE_LOW
        );
        kanal.setDescription("Zeigt an, dass ein Lauf gerade aufgezeichnet wird.");
        kanal.setShowBadge(false);
        NotificationManager verwalter = getSystemService(NotificationManager.class);
        if (verwalter != null) verwalter.createNotificationChannel(kanal);
    }

    private Notification benachrichtigungBauen() {
        Intent zurueck = new Intent(this, MainActivity.class);
        zurueck.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flaggen = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Ab Android 12 muss jede PendingIntent ausdruecklich als
            // veraenderbar oder unveraenderbar gekennzeichnet sein.
            flaggen |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent tippen = PendingIntent.getActivity(this, 0, zurueck, flaggen);

        return new NotificationCompat.Builder(this, KANAL_ID)
            .setSmallIcon(R.drawable.ic_aufzeichnung)
            .setContentTitle("MyProSole zeichnet auf")
            .setContentText(anzeigeText())
            .setContentIntent(tippen)
            // Nicht wegwischbar. Das verlangt Android fuer einen
            // Vordergrunddienst - und es ist richtig so: Eine
            // Standortaufzeichnung, die man versehentlich unsichtbar machen
            // kann, waere unehrlich.
            .setOngoing(true)
            // Nur beim ersten Mal melden. Ohne das blinkt die Statusleiste
            // bei jeder Auffrischung.
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(false)
            .build();
    }

    /**
     * Was in der Benachrichtigung steht.
     *
     * Bewusst nur Zeit und Empfang - keine Strecke, keine Pace.
     *
     * Der Dienst kennt sie naemlich nicht: Strecke und Pace entstehen aus der
     * Bewegungserkennung in JavaScript, und die schlaeft im Hintergrund. Die
     * letzten bekannten Werte stehenzulassen hiesse, eine eingefrorene Zahl
     * zu zeigen, die aussieht wie eine Messung. Genau das haben wir in der
     * App schon abgeschafft.
     *
     * Die Zeit dagegen kennt der Dienst selbst, und ob gerade Messungen
     * hereinkommen weiss er auch. Beides stimmt immer.
     */
    private String anzeigeText() {
        long sekunden = Math.max(0, (System.currentTimeMillis() - startZeit) / 1000);
        String dauer = String.format(
            Locale.GERMANY, "%d:%02d:%02d",
            sekunden / 3600, (sekunden % 3600) / 60, sekunden % 60
        );

        boolean frisch = letzteMessungMs > 0
            && System.currentTimeMillis() - letzteMessungMs <= EMPFANG_FRISCH_MS;
        return dauer + (frisch ? " · GPS aktiv" : " · warte auf GPS");
    }

    private boolean inDenVordergrund() {
        try {
            Notification n = benachrichtigungBauen();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Ab Android 10 gibt es die Ueberladung mit Typ, ab Android 14
                // ist sie Pflicht. Das gelesene Fremdwerk importiert
                // ServiceInfo und benutzt es nirgends - dazu passen dessen
                // offene Abstuerze auf neueren Android-Fassungen.
                startForeground(
                    BENACHRICHTIGUNG_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                );
            } else {
                startForeground(BENACHRICHTIGUNG_ID, n);
            }
            return true;
        } catch (Exception e) {
            // Faellt hierher, wenn die Standortberechtigung doch noch fehlt
            // (SecurityException ab Android 14) oder ein Hersteller
            // dazwischenfunkt. Kein Absturz - die App bleibt bedienbar und
            // kann es erneut versuchen.
            Log.e(MARKE, "Dienst konnte nicht in den Vordergrund", e);
            return false;
        }
    }

    private void benachrichtigungAuffrischen() {
        NotificationManager verwalter = getSystemService(NotificationManager.class);
        if (verwalter == null) return;
        try {
            verwalter.notify(BENACHRICHTIGUNG_ID, benachrichtigungBauen());
        } catch (Exception e) {
            Log.w(MARKE, "Benachrichtigung liess sich nicht auffrischen", e);
        }
    }

    // ---- Kleinkram -----------------------------------------------------

    private SharedPreferences einstellungen() {
        return getSharedPreferences(ABLAGE, Context.MODE_PRIVATE);
    }

    private boolean hatOrtungsrecht() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Haelt den Rechenkern wach.
     *
     * Ohne das verwirft Android im Doze-Zustand Messungen, bevor sie
     * gespeichert sind. Die Sperre gilt nur, solange ein Lauf laeuft, und
     * wird beim Beenden zurueckgegeben - ein vergessener Wachhalter waere ein
     * Akkufresser, den niemand findet.
     */
    private void wachhalterNehmen() {
        if (wachhalter != null && wachhalter.isHeld()) return;
        PowerManager strom = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (strom == null) return;
        wachhalter = strom.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, MARKE + "::Lauf");
        wachhalter.setReferenceCounted(false);
        wachhalter.acquire();
    }

    private void wachhalterZurueckgeben() {
        if (wachhalter != null && wachhalter.isHeld()) {
            wachhalter.release();
        }
        wachhalter = null;
    }
}
