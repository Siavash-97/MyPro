package com.myprosole.app.aufzeichnung;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import org.json.JSONObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/**
 * Die Bruecke zwischen der App und dem Aufzeichnungsdienst.
 *
 * Warum es diese Bruecke ueberhaupt braucht
 * -----------------------------------------
 * Der Dienst ist `exported="false"` - niemand ausser dieser App darf ihn
 * starten. Beim ersten Geraetetest kam dementsprechend:
 *
 *     Error: Requires permission not exported from uid 10487
 *
 * Das ist richtig so. Es heisst aber: Der Dienst laesst sich nicht von aussen
 * anstossen, auch nicht zum Pruefen. Und selbst wenn man ihn kurz freigaebe,
 * kaeme der Start vom Shell-Benutzer - aus Androids Sicht also aus dem
 * Hintergrund, und das ist seit Android 12 verboten. Ein Fehlschlag waere
 * dann nicht zuzuordnen.
 *
 * Nur die App selbst darf ihn starten, im Vordergrund, auf eine
 * Nutzerhandlung hin. Genau das tut diese Bruecke.
 *
 * Was hier NICHT passiert
 * -----------------------
 * Keine Fachlogik. Die Bruecke reicht durch und rechnet nicht. Alles
 * Fachliche steht in lib/bewegung.ts, wo es geprueft ist.
 */
@CapacitorPlugin(
    name = "Aufzeichnung",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = AufzeichnungPlugin.SCHRITTE)
    }
)
public class AufzeichnungPlugin extends Plugin {

    private static final String MARKE = "MyProSole.Aufzeichnung";
    /** Kennung der Schrittzaehler-Berechtigung fuer Capacitor. */
    static final String SCHRITTE = "schritte";
    /** Wie viele Punkte hoechstens auf einmal herausgegeben werden. */
    private static final int BUENDEL = 500;

    private PunkteSpeicher speicher;

    @Override
    public void load() {
        speicher = PunkteSpeicher.hole(getContext());
    }

    /**
     * Aufzeichnung starten.
     *
     * Muss aus einer sichtbaren App heraus aufgerufen werden, und erst
     * nachdem die Standortberechtigung erteilt ist. Beides wird hier
     * geprueft, statt es dem Aufrufer zu ueberlassen - ein
     * Vordergrunddienst, der wegen fehlender Erlaubnis abgelehnt wird,
     * stuerzt auf Android 14+ die App ab, wenn niemand es abfaengt.
     */
    @PluginMethod
    public void starten(PluginCall aufruf) {
        String laufId = aufruf.getString("laufId");
        if (laufId == null || laufId.isEmpty()) {
            aufruf.reject("Ohne Laufkennung kann nicht aufgezeichnet werden.");
            return;
        }

        if (!hatOrtungsrecht()) {
            // Kein reject: Das ist kein Fehler, sondern ein Zustand, den die
            // Oberflaeche benennen koennen muss.
            aufruf.resolve(ergebnis(false, "keine-erlaubnis"));
            return;
        }

        if (!gpsEingeschaltet()) {
            aufruf.resolve(ergebnis(false, "gps-aus"));
            return;
        }

        try {
            AufzeichnungsDienst.starten(getContext(), laufId);
            Log.i(MARKE, "Dienst angestossen fuer Lauf " + laufId);
            aufruf.resolve(ergebnis(true, null));
        } catch (Exception e) {
            // Faellt hierher, wenn Android den Start verweigert - etwa weil
            // die App doch im Hintergrund war.
            Log.e(MARKE, "Dienst liess sich nicht starten", e);
            aufruf.resolve(ergebnis(false, "start-abgelehnt"));
        }
    }

    /** Aufzeichnung beenden. Der Dienst endet wirklich - siehe Manifest. */
    // ---- Schrittzaehler: die Berechtigung ------------------------------
    //
    // Warum diese drei Methoden hier liegen und nicht in einem eigenen
    // Plugin: Der Schrittzaehler wird vom AufzeichnungsDienst gelesen, und
    // der haengt an dieser Bruecke. Ein zweites Plugin waere eine zweite
    // Schnittstelle fuer dieselbe Sache.

    /**
     * Wie steht es um die Erlaubnis? Fragt nach, ohne zu fragen.
     *
     * Die Zuordnung der Zustaende ist nicht frei gewaehlt, sondern am
     * Quelltext von Capacitor belegt (`Bridge.java`, Zeile 1180-1186):
     * Nach einer Ablehnung wird `DENIED` gespeichert, wenn
     * `shouldShowRequestPermissionRationale()` false liefert - also genau
     * dann, wenn Android den Dialog nicht mehr zeigt. Deshalb:
     *
     *   GRANTED                -> erteilt
     *   PROMPT                 -> nicht-erlaubt          (nie gefragt)
     *   PROMPT_WITH_RATIONALE  -> nicht-erlaubt          (fragt nochmal)
     *   DENIED                 -> nicht-erlaubt-endgueltig
     *
     * Die Reihenfolge der Pruefungen traegt die Regel aus
     * `docs/messquellen.md`: *"Der Satz 'hat dein Geraet nicht' darf NUR
     * fallen, wenn die Abfrage ohne Berechtigungsfrage moeglich war."*
     *
     * Konkret: Ein Sensor, der NICHT null ist, beweist, dass es ihn gibt -
     * unabhaengig davon, ob `getDefaultSensor` berechtigungsgefiltert ist.
     * Ein `null` beweist dagegen nichts, solange die Erlaubnis fehlt. Also
     * wird `kein-sensor` nur gemeldet, wenn die Erlaubnis da ist (oder gar
     * keine noetig war) und der Sensor trotzdem fehlt. Damit ist die
     * ungeklaerte Frage, ob `getDefaultSensor` filtert, hier ohne Belang.
     */
    @PluginMethod
    public void schrittrechtStand(PluginCall aufruf) {
        JSObject antwort = new JSObject();
        antwort.put("stand", schrittrechtLesen());
        aufruf.resolve(antwort);
    }

    private String schrittrechtLesen() {
        boolean erlaubt;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // Vor Android 10 gibt es die Berechtigung nicht; der Sensor ist
            // frei lesbar.
            erlaubt = true;
        } else {
            PermissionState stand = getPermissionState(SCHRITTE);
            // Kein Zustand heisst: Wir wissen es nicht. Der milde Zustand
            // aus docs/messquellen.md Abschnitt 4 - und ausdruecklich NICHT
            // "nicht-erlaubt", denn das erzeugt am Bildschirm den Satz
            // "Dein Telefon kann das", also eine Behauptung ueber ein
            // Geraet, ueber das wir nichts wissen.
            if (stand == null) return "unbekannt";
            if (stand == PermissionState.DENIED) return "nicht-erlaubt-endgueltig";
            erlaubt = stand == PermissionState.GRANTED;
        }

        if (!erlaubt) return "nicht-erlaubt";

        SensorManager sensoren = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensoren == null) return "unbekannt";
        boolean hatSensor = sensoren.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
            || sensoren.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null;
        return hatSensor ? "erteilt" : "kein-sensor";
    }

    /**
     * Den Systemdialog zeigen und den Zustand DANACH melden.
     *
     * Android zeigt ihn hoechstens zweimal. Wer diese Methode aufruft,
     * verbraucht einen der beiden Versuche - deshalb entscheidet
     * `lib/schrittrecht.ts` (`bietetImLaufAn`), wann sie ueberhaupt
     * angeboten wird, und nicht diese Bruecke.
     */
    @PluginMethod
    public void schrittrechtAnfordern(PluginCall aufruf) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject antwort = new JSObject();
            antwort.put("stand", schrittrechtLesen());
            aufruf.resolve(antwort);
            return;
        }
        requestPermissionForAlias(SCHRITTE, aufruf, "schrittrechtErgebnis");
    }

    @PermissionCallback
    private void schrittrechtErgebnis(PluginCall aufruf) {
        String stand = schrittrechtLesen();
        if ("erteilt".equals(stand)) schritteNachmelden();
        JSObject antwort = new JSObject();
        antwort.put("stand", stand);
        aufruf.resolve(antwort);
    }

    /**
     * Dem laufenden Dienst sagen, dass er den Sensor jetzt anmelden darf.
     *
     * Ohne das bliebe die frisch erteilte Erlaubnis bis zum Laufende
     * wirkungslos: Der Dienst meldet den Zuhoerer nur beim Start und beim
     * Fortsetzen an, und beim Start gab es die Erlaubnis noch nicht.
     *
     * Nur wenn ueberhaupt ein Lauf gemerkt ist - sonst wuerde diese Absicht
     * einen Dienst erzeugen, der nichts zu tun hat.
     */
    private void schritteNachmelden() {
        SharedPreferences ablage = getContext()
            .getSharedPreferences(AufzeichnungsDienst.ABLAGE_NAME, Context.MODE_PRIVATE);
        if (ablage.getString(AufzeichnungsDienst.SCHLUESSEL_LAUF_OEFFENTLICH, null) == null) return;
        try {
            Intent absicht = new Intent(getContext(), AufzeichnungsDienst.class);
            absicht.setAction(AufzeichnungsDienst.AKTION_SCHRITTE);
            getContext().startService(absicht);
        } catch (Exception e) {
            Log.w(MARKE, "Schritt-Nachmeldung kam nicht an", e);
        }
    }

    /**
     * Die Systemeinstellungen dieser App oeffnen.
     *
     * Der einzige Weg, wenn Android nicht mehr fragt. Ohne
     * FLAG_ACTIVITY_NEW_TASK wirft Android hier, weil der Aufruf nicht aus
     * einer Activity kommt.
     */
    @PluginMethod
    public void appEinstellungenOeffnen(PluginCall aufruf) {
        try {
            Intent absicht = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            absicht.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            absicht.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(absicht);
            aufruf.resolve();
        } catch (Exception e) {
            // Kein Absturz: Es gibt Geraete ohne diesen Bildschirm. Die
            // Oberflaeche erfaehrt es und kann es sagen, statt einen Knopf
            // anzubieten, der nichts tut.
            Log.w(MARKE, "Einstellungen liessen sich nicht oeffnen", e);
            aufruf.reject("Einstellungen nicht verfuegbar");
        }
    }

    @PluginMethod
    public void stoppen(PluginCall aufruf) {
        try {
            AufzeichnungsDienst.stoppen(getContext());
            Log.i(MARKE, "Dienst gestoppt");
        } catch (Exception e) {
            Log.w(MARKE, "Dienst liess sich nicht sauber stoppen", e);
        }
        aufruf.resolve(ergebnis(true, null));
    }

    /**
     * Die aeltesten offenen Punkte holen.
     *
     * Loescht nichts. Erst {@link #bestaetigen} raeumt auf - so kostet ein
     * Absturz dazwischen keinen Punkt.
     */
    @PluginMethod
    public void abholen(PluginCall aufruf) {
        String laufId = aufruf.getString("laufId");
        if (laufId == null) {
            aufruf.reject("Ohne Laufkennung gibt es nichts abzuholen.");
            return;
        }
        JSONArray punkte = speicher.offene(laufId, BUENDEL);
        JSObject antwort = new JSObject();
        antwort.put("punkte", punkte);
        antwort.put("offen", speicher.anzahl(laufId));
        aufruf.resolve(antwort);
    }

    /** Alles bis einschliesslich dieser Kennung ist angekommen und darf weg. */
    @PluginMethod
    public void bestaetigen(PluginCall aufruf) {
        String laufId = aufruf.getString("laufId");
        Integer bisId = aufruf.getInt("bisId");
        if (laufId == null || bisId == null) {
            aufruf.reject("Laufkennung und bisId werden gebraucht.");
            return;
        }
        int weg = speicher.bestaetigen(laufId, bisId);
        JSObject antwort = new JSObject();
        antwort.put("geloescht", weg);
        antwort.put("offen", speicher.anzahl(laufId));
        aufruf.resolve(antwort);
    }

    /**
     * Alle Punkte eines Laufs wegwerfen.
     *
     * Fuer den Fall, dass ein Lauf verworfen statt gespeichert wird. Ohne das
     * blieben sie fuer immer liegen - genau die Sorte Rest, die spaeter
     * niemand mehr zuordnen kann.
     */
    @PluginMethod
    public void verwerfen(PluginCall aufruf) {
        String laufId = aufruf.getString("laufId");
        if (laufId == null) {
            aufruf.reject("Ohne Laufkennung ist nichts zu verwerfen.");
            return;
        }
        JSObject antwort = new JSObject();
        antwort.put("geloescht", speicher.verwerfen(laufId));
        aufruf.resolve(antwort);
    }

    /**
     * Pausieren oder fortsetzen.
     *
     * Der Dienst laeuft in der Pause weiter und behaelt die bisherigen
     * Punkte; nur der Empfaenger wird abgemeldet. Die Zeitrechnung bleibt
     * Sache der App.
     */
    @PluginMethod
    public void pausieren(PluginCall aufruf) {
        Boolean an = aufruf.getBoolean("an");
        if (an == null) {
            aufruf.reject("an fehlt.");
            return;
        }
        Intent absicht = new Intent(getContext(), AufzeichnungsDienst.class);
        absicht.setAction(an ? AufzeichnungsDienst.AKTION_PAUSE
                             : AufzeichnungsDienst.AKTION_WEITER);
        try {
            getContext().startService(absicht);
            aufruf.resolve(ergebnis(true, null));
        } catch (Exception e) {
            Log.w(MARKE, "Pausenbefehl kam nicht an", e);
            aufruf.resolve(ergebnis(false, "start-abgelehnt"));
        }
    }

    /**
     * Wie steht es gerade?
     *
     * Fuer die Anzeige und zum Nachsehen beim Pruefen: wie viele Punkte
     * warten, ob die Erlaubnis da ist, ob GPS an ist, ob pausiert wird - und
     * ob jemand in der Benachrichtigung auf "Beenden" getippt hat.
     *
     * Der Beendenwunsch wird beim Lesen geloescht. Er ist eine einmalige
     * Nachricht, kein Zustand: Bliebe er stehen, fragte die App nach jedem
     * Oeffnen erneut nach - auch wenn man laengst abgelehnt hat.
     */
    /**
     * Den Beendenwunsch quittieren.
     *
     * Getrennt von `stand`, weil eine Abfrage nichts veraendern soll. Wer
     * den Wunsch gesehen und behandelt hat, sagt es ausdruecklich - dann
     * und nur dann verschwindet er.
     */
    @PluginMethod
    public void beendenWunschQuittieren(PluginCall aufruf) {
        getContext()
            .getSharedPreferences(AufzeichnungsDienst.ABLAGE_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(AufzeichnungsDienst.SCHLUESSEL_BEENDEN_WUNSCH)
            .apply();
        aufruf.resolve();
    }

    @PluginMethod
    public void stand(PluginCall aufruf) {
        String laufId = aufruf.getString("laufId");
        SharedPreferences ablage = getContext()
            .getSharedPreferences(AufzeichnungsDienst.ABLAGE_NAME, Context.MODE_PRIVATE);

        // NUR LESEN. Bis zum 28.08.2026 loeschte diese Abfrage den Merker
        // gleich mit - eine Abfrage, die beim Lesen etwas veraendert. Ihr
        // Aufrufer sitzt in einem `visibilitychange`-Handler
        // (`LiveTracking.tsx`), also verbrauchte jeder Wechsel in den
        // Vordergrund die Nachricht, unabhaengig davon, ob jemand sie
        // gesehen hat. Das Quittieren ist jetzt ein eigener Aufruf.
        boolean beendenWunsch =
            ablage.getBoolean(AufzeichnungsDienst.SCHLUESSEL_BEENDEN_WUNSCH, false);

        JSObject antwort = new JSObject();
        antwort.put("offen", laufId == null ? 0 : speicher.anzahl(laufId));
        antwort.put("erlaubt", hatOrtungsrecht());
        antwort.put("gpsAn", gpsEingeschaltet());
        antwort.put("pausiert", ablage.getBoolean(AufzeichnungsDienst.SCHLUESSEL_PAUSIERT, false));
        antwort.put("laeuft", ablage.contains(AufzeichnungsDienst.SCHLUESSEL_LAUF_OEFFENTLICH));

        // Die Kennung der laufenden Aufzeichnung - und zwar auch dann, wenn
        // der Aufrufer sie nicht mitgebracht hat.
        //
        // Bis zum 22.08.2026 behielt der Dienst sie fuer sich. Die App hielt
        // sie nur im Arbeitsspeicher; schoss Android sie ab, war sie weg, und
        // niemand konnte die gesammelten Punkte je wieder abholen. Gemessen
        // lagen 611 verwaiste Punkte im Speicher und neun von sechzehn
        // Laeufen hingen auf "tracking".
        String laufendeKennung =
            ablage.getString(AufzeichnungsDienst.SCHLUESSEL_LAUF_OEFFENTLICH, null);
        if (laufendeKennung == null) {
            antwort.put("laufId", JSONObject.NULL);
        } else {
            antwort.put("laufId", laufendeKennung);
        }

        // Wie viele Punkte warten - notfalls fuer die eigene Kennung, damit
        // ein Aufrufer ohne Kennung trotzdem erfaehrt, dass etwas daliegt.
        if (laufId == null && laufendeKennung != null) {
            antwort.put("offen", speicher.anzahl(laufendeKennung));
        }

        // Wann kam die letzte Messung? Daran entscheidet die App, ob eine
        // gefundene Aufzeichnung fortgesetzt oder abgeschlossen gehoert.
        String kennungFuerZeit = laufId != null ? laufId : laufendeKennung;
        long letzte = kennungFuerZeit == null ? 0L : speicher.letzteZeit(kennungFuerZeit);
        if (letzte <= 0L) {
            antwort.put("letzterPunktMs", JSONObject.NULL);
        } else {
            antwort.put("letzterPunktMs", letzte);
        }
        // Wann der Lauf begonnen hat. Der Dienst wusste es immer - er baut
        // damit den Chronometer der Benachrichtigung. Ohne diese Angabe muss
        // die Bergung die Startzeit raten, und geraten wurde auf die Zeit der
        // letzten Messung: Ein Lauf von einer Stunde galt dann als Sekunden
        // lang und fiel unter die Mindestdauer.
        long start = ablage.getLong(AufzeichnungsDienst.SCHLUESSEL_START_OEFFENTLICH, 0L);
        if (start <= 0L) {
            antwort.put("startMs", JSONObject.NULL);
        } else {
            antwort.put("startMs", start);
        }

        // Alle Sitzungen, fuer die noch Punkte liegen - nicht nur die
        // laufende. Ohne das fand die Bergung immer nur die juengste
        // verwaiste Aufzeichnung; 611 Punkte vom 21.08. lagen am 23.08. noch
        // erreichbar da und wurden von niemandem geholt.
        antwort.put("offeneSitzungen", speicher.offeneSitzungen());

        antwort.put("beendenGewuenscht", beendenWunsch);
        aufruf.resolve(antwort);
    }

    // ---- Kleinkram -----------------------------------------------------

    private JSObject ergebnis(boolean gelungen, String hindernis) {
        JSObject o = new JSObject();
        o.put("gelungen", gelungen);
        o.put("hindernis", hindernis);
        return o;
    }

    private boolean hatOrtungsrecht() {
        return getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean gpsEingeschaltet() {
        LocationManager ortung =
            (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (ortung == null) return false;
        try {
            return ortung.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception e) {
            return false;
        }
    }
}
