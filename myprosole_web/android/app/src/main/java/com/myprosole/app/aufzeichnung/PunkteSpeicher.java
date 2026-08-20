package com.myprosole.app.aufzeichnung;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.location.Location;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Die Messpunkte eines Laufs, auf der Platte.
 *
 * Warum ueberhaupt hier und nicht im WebView
 * ------------------------------------------
 * Capacitor friert eine im Hintergrund liegende Seite nach fuenf Minuten
 * ein; Ereignisse an JavaScript werden dann gepuffert statt zugestellt. Der
 * Fehler ist seit Januar 2023 bekannt und im Februar 2026 als "wird nicht
 * behoben" geschlossen worden.
 *
 * Ein Dienst, der Punkte nur an JavaScript weiterreicht, verlagert das
 * Problem also, statt es zu loesen. Deshalb gilt hier: Der Dienst schreibt
 * selbst, JavaScript ist Anzeige und nicht Aufzeichnung.
 *
 * Beide Fremdwerke, die als Vorlage gelesen wurden, haben genau das nicht -
 * das eine speichert gar nichts, das andere schreibt im eigenen Quelltext
 * "no on-disk queue and no automatic retry".
 *
 * Warum SQLite und keine Datei
 * ----------------------------
 * Eine angehaengte Zeile in einer Datei ist einfacher, aber das Loeschen des
 * bereits Abgeholten waere es nicht: Man muesste die Datei umschreiben,
 * waehrend der Dienst weiterschreibt. SQLite bringt beides mit und ist in
 * Android ohnehin da - keine zusaetzliche Abhaengigkeit.
 *
 * Groessenordnung: Ein Lauf ueber eine Stunde mit einer Messung je Sekunde
 * sind 3600 Zeilen. Fuer SQLite ist das nichts.
 */
class PunkteSpeicher extends SQLiteOpenHelper {

    private static final String DATEI = "aufzeichnung.db";
    private static final int FASSUNG = 1;
    private static final String TABELLE = "punkte";

    private static PunkteSpeicher einziger;

    /**
     * Ein Speicher fuer den ganzen Prozess.
     *
     * Dienst und Bruecke greifen beide zu. Zwei Instanzen haetten zwei
     * Verbindungen zur selben Datei - SQLite kaeme damit zurecht, aber
     * gleichzeitige Schreibzugriffe waeren dann eine Frage der Zeitpunkte
     * statt eine Frage der Reihenfolge.
     */
    static synchronized PunkteSpeicher hole(Context zusammenhang) {
        if (einziger == null) {
            einziger = new PunkteSpeicher(zusammenhang.getApplicationContext());
        }
        return einziger;
    }

    private PunkteSpeicher(Context zusammenhang) {
        super(zusammenhang, DATEI, null, FASSUNG);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // Die Spalten heissen wie die Felder, die JavaScript erwartet - so
        // gibt es keine Uebersetzungstabelle, die auseinanderlaufen kann.
        //
        // Alles ausser Ort und Zeit darf fehlen: Nicht jedes Geraet meldet
        // Tempo, Guete oder Hoehe. Fehlend ist etwas anderes als null, und
        // die Bewegungserkennung in JavaScript rechnet damit.
        db.execSQL(
            "create table " + TABELLE + " ("
                + "id integer primary key autoincrement, "
                + "laufId text not null, "
                + "zeit integer not null, "
                + "breite real not null, "
                + "laenge real not null, "
                + "genauigkeitM real, "
                + "tempoMps real, "
                + "tempoGueteMps real, "
                + "hoeheM real"
                + ")"
        );
        // Abgeholt wird immer der aelteste Teil eines bestimmten Laufs.
        db.execSQL("create index punkte_lauf_zeit on " + TABELLE + " (laufId, id)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int alt, int neu) {
        // Es gibt bisher nur eine Fassung. Kommt eine zweite, wird hier
        // erweitert und nicht geloescht: In dieser Tabelle koennen Punkte
        // eines gerade laufenden Laufs stehen.
    }

    /**
     * Eine Messung ablegen.
     *
     * Gibt zurueck, ob es geklappt hat. Der Dienst darf daran nicht
     * scheitern - eine volle Platte beendet keinen Lauf, sie kostet einen
     * Punkt.
     */
    boolean merken(String laufId, Location ort) {
        ContentValues werte = new ContentValues();
        werte.put("laufId", laufId);
        werte.put("zeit", ort.getTime());
        werte.put("breite", ort.getLatitude());
        werte.put("laenge", ort.getLongitude());

        if (ort.hasAccuracy()) werte.put("genauigkeitM", ort.getAccuracy());
        if (ort.hasSpeed()) werte.put("tempoMps", ort.getSpeed());
        if (ort.hasAltitude()) werte.put("hoeheM", ort.getAltitude());

        // Die Guete der Geschwindigkeit selbst - ab Android 8. Kein
        // kostenloses Plugin reicht dieses Feld durch; das kostenpflichtige
        // wirbt damit. Selbst gebaut bekommen wir es geschenkt, und die
        // Bewegungserkennung kann Doppler-Werte spaeter danach gewichten
        // statt sie nur nach der Ortsgenauigkeit zu filtern.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && ort.hasSpeedAccuracy()) {
            werte.put("tempoGueteMps", ort.getSpeedAccuracyMetersPerSecond());
        }

        try {
            return getWritableDatabase().insert(TABELLE, null, werte) != -1;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Die aeltesten offenen Punkte eines Laufs, als JSON.
     *
     * Geloescht wird hier nichts. Das passiert erst, wenn JavaScript das
     * Ankommen bestaetigt - siehe {@link #bestaetigen}. Ein Absturz
     * dazwischen kostet nichts: Die Punkte kommen beim naechsten Abholen
     * erneut. Doppelt ist harmlos, weg waere es nicht.
     */
    JSONArray offene(String laufId, int hoechstens) {
        JSONArray liste = new JSONArray();
        Cursor zeiger = null;
        try {
            zeiger = getReadableDatabase().query(
                TABELLE,
                null,
                "laufId = ?",
                new String[]{laufId},
                null, null,
                "id asc",
                String.valueOf(hoechstens)
            );
            while (zeiger.moveToNext()) {
                liste.put(alsJson(zeiger));
            }
        } catch (Exception e) {
            // Lieber eine leere Liste als ein Absturz. Beim naechsten
            // Abholen wird es erneut versucht.
        } finally {
            if (zeiger != null) zeiger.close();
        }
        return liste;
    }

    private JSONObject alsJson(Cursor z) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", z.getLong(z.getColumnIndexOrThrow("id")));
        o.put("zeit", z.getLong(z.getColumnIndexOrThrow("zeit")));
        o.put("breite", z.getDouble(z.getColumnIndexOrThrow("breite")));
        o.put("laenge", z.getDouble(z.getColumnIndexOrThrow("laenge")));
        // Ausdruecklich JSONObject.NULL statt die Spalte wegzulassen:
        // Ein fehlendes Feld waere in JavaScript "undefined", und die
        // Bewegungserkennung prueft auf null.
        zahlOderNull(o, z, "genauigkeitM");
        zahlOderNull(o, z, "tempoMps");
        zahlOderNull(o, z, "tempoGueteMps");
        zahlOderNull(o, z, "hoeheM");
        return o;
    }

    private void zahlOderNull(JSONObject o, Cursor z, String spalte) throws JSONException {
        int stelle = z.getColumnIndexOrThrow(spalte);
        if (z.isNull(stelle)) {
            o.put(spalte, JSONObject.NULL);
        } else {
            o.put(spalte, z.getDouble(stelle));
        }
    }

    /** Alles bis einschliesslich dieser Kennung ist angekommen und darf weg. */
    int bestaetigen(String laufId, long bisId) {
        try {
            return getWritableDatabase().delete(
                TABELLE,
                "laufId = ? and id <= ?",
                new String[]{laufId, String.valueOf(bisId)}
            );
        } catch (Exception e) {
            return 0;
        }
    }

    /** Wie viele Punkte warten noch? Fuer die Anzeige und zum Nachsehen. */
    int anzahl(String laufId) {
        Cursor zeiger = null;
        try {
            zeiger = getReadableDatabase().rawQuery(
                "select count(*) from " + TABELLE + " where laufId = ?",
                new String[]{laufId}
            );
            return zeiger.moveToFirst() ? zeiger.getInt(0) : 0;
        } catch (Exception e) {
            return 0;
        } finally {
            if (zeiger != null) zeiger.close();
        }
    }

    /**
     * Alles zu einem Lauf wegwerfen.
     *
     * Fuer den Fall, dass ein Lauf verworfen statt gespeichert wird. Ohne das
     * blieben die Punkte eines weggeworfenen Laufs fuer immer liegen - genau
     * die Sorte Rest, die spaeter niemand mehr zuordnen kann.
     */
    int verwerfen(String laufId) {
        try {
            return getWritableDatabase().delete(
                TABELLE, "laufId = ?", new String[]{laufId}
            );
        } catch (Exception e) {
            return 0;
        }
    }
}
