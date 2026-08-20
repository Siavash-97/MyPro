package com.myprosole.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.myprosole.app.aufzeichnung.AufzeichnungPlugin;
import com.myprosole.app.aufzeichnung.AufzeichnungsDienst;

public class MainActivity extends BridgeActivity {

    /**
     * Eigene Plugins muessen VOR super.onCreate angemeldet werden - dort baut
     * Capacitor die Bruecke auf. Danach angemeldet, kennt JavaScript sie
     * nicht, und der Aufruf scheitert mit "not implemented" statt mit einer
     * verstaendlichen Meldung.
     */
    @Override
    public void onCreate(Bundle zustand) {
        registerPlugin(AufzeichnungPlugin.class);
        super.onCreate(zustand);
        beendenWunschMerken(getIntent());
    }

    /**
     * Laeuft die App schon, kommt der Tipper auf "Beenden" hier an und nicht
     * in onCreate. Beides muss bedient werden - sonst wirkt der Knopf mal und
     * mal nicht, je nachdem ob die App gerade im Speicher war.
     */
    @Override
    public void onNewIntent(Intent absicht) {
        super.onNewIntent(absicht);
        setIntent(absicht);
        beendenWunschMerken(absicht);
    }

    /**
     * Den Wunsch nur notieren, nicht ausfuehren.
     *
     * Der Lauf laeuft weiter, bis in der App bestaetigt wurde. Ein Lauf ist
     * Arbeit von einer Stunde; ihn mit einem einzigen Tipper in der
     * Statusleiste wegwerfen zu koennen - womoeglich in der Hosentasche -
     * waere ein schlechter Handel.
     */
    private void beendenWunschMerken(Intent absicht) {
        if (absicht == null) return;
        if (!absicht.getBooleanExtra(AufzeichnungsDienst.EXTRA_BEENDEN, false)) return;
        getSharedPreferences(AufzeichnungsDienst.ABLAGE_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(AufzeichnungsDienst.SCHLUESSEL_BEENDEN_WUNSCH, true)
            .apply();
        // Damit ein spaeteres Wiederaufnehmen der Activity den Wunsch nicht
        // erneut ausloest.
        absicht.removeExtra(AufzeichnungsDienst.EXTRA_BEENDEN);
    }
}
