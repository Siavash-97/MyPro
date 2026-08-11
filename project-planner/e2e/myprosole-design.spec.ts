import { expect, test } from '@playwright/test';


const mockupEntry = new URL(
  '../../myprosole_app/design/mockups/index.html',
  import.meta.url,
).href;


const mockupUrl = (file: string) =>
  new URL(`../../myprosole_app/design/mockups/${file}`, import.meta.url).href;


test('runs the primary MyProSole onboarding and activity flow', async ({ page }) => {
  await page.goto(mockupEntry);

  await expect(page).toHaveURL(/welcome\.html$/);
  await expect(page.getByText('Deine Lauftechnik, verständlich erklärt.')).toBeVisible();

  await page.getByRole('link', { name: 'Mit E-Mail fortfahren' }).click();
  await expect(page).toHaveURL(/register\.html$/);

  await page.getByRole('button', { name: 'Registrieren' }).click();
  await expect(page).toHaveURL(/register\.html$/);

  await page.getByLabel('Name').fill('Test Runner');
  await page.getByLabel('E-Mail').fill('runner@example.test');
  await page.getByLabel('Passwort').fill('sicheres-testpasswort');
  await page.locator('#register-consent').check();
  await page.getByRole('button', { name: 'Registrieren' }).click();

  // Nach der Registrierung kommt die Anamnese: erst die Ankuendigung beider
  // Bloecke, dann Block A. Der Testlauf antwortet ueberall "Nein", damit die
  // Verzweigungen (a7, Verletzungs-Detailblock) geschlossen bleiben.
  await expect(page).toHaveURL(/anamnese\.html\??$/);
  await expect(page.getByText('Lass uns deinen Laufplan erstellen')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();

  const frage = (schritt: string) =>
    page.locator(`section[data-anamnese-schritt="${schritt}"]`);
  const weiter = () => page.getByRole('button', { name: 'Weiter' }).click();

  await frage('a1').getByText('Schmerzfrei laufen').click();
  await weiter();
  await frage('a2').getByText('Nein', { exact: true }).click();
  await weiter();
  await weiter(); // a3: Stepper tragen immer einen Wert
  await frage('a4').getByText('2–3 Tage').click();
  await weiter();
  await weiter(); // a5: Stepper
  await frage('a6').getByText('Nein', { exact: true }).click();
  await weiter();
  await frage('a8').getByText('Nein', { exact: true }).click();
  await weiter();
  await frage('a9').getByText('Nein', { exact: true }).click();
  await weiter();
  await frage('a10').getByText('Keine Angabe').click();
  await weiter();

  // Block B versperrt nichts: "Nicht interessiert" fuehrt zur
  // Geraete-Station, nicht in eine weitere Fragerunde.
  await expect(page.getByText('deine Angaben sind komplett')).toBeVisible();
  await page.getByRole('button', { name: 'Nicht interessiert' }).click();

  // Beide Geraete auf einer Seite; wer beide waehlt, verbindet beide
  // nacheinander. Danach steht der Plan – aus den eigenen Antworten.
  await expect(page.getByText('was möchtest du verbinden?')).toBeVisible();
  await frage('geraete').getByText('Smartwatch verbinden').click();
  await frage('geraete').getByText('MyProSole-Einlagen verbinden').click();
  await page.getByRole('button', { name: 'Auswahl verbinden' }).click();
  await expect(page.getByText('Smartwatch verbunden')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Einlagen verbunden')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Dein Plan ist erstellt')).toBeVisible();
  await page.getByRole('link', { name: 'Zu deinem Plan' }).click();

  await expect(page).toHaveURL(/home\.html$/);
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeVisible();
  await page.locator('a[href="profil-einrichten.html"]').click();
  await expect(page).toHaveURL(/profil-einrichten\.html$/);
  await page.getByRole('button', { name: 'Profil übernehmen' }).click();
  await expect(page).toHaveURL(/profil-einrichten\.html\??$/);

  await page.getByLabel('Wie dürfen wir dich nennen?').fill('Test Runner');
  // Bewusst ohne Offenlegung: der Hauptablauf muss auch dann durchlaufen.
  await page.getByLabel('Geschlecht').selectOption('undisclosed');
  await page.getByLabel('Wie läufst du aktuell?').selectOption('recreational');
  await page.getByRole('button', { name: 'Profil übernehmen' }).click();

  await expect(page).toHaveURL(/home\.html\??$/);
  await page.getByRole('link', { name: /Laufen starten/ }).click();
  await expect(page).toHaveURL(/live-tracking\.html$/);

  await page.getByRole('link', { name: 'Beenden' }).click();
  await expect(page).toHaveURL(/trainingstagebuch\.html\?from=tracking$/);
  await expect(page.getByText('Aus deinem Lauf übernommen')).toBeVisible();

  // Frisch nach dem Lauf lässt sich das Tagebuch überspringen, statt den
  // Hauptablauf aufzuhalten.
  await page.getByRole('link', { name: 'Später eintragen' }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html\?from=tracking$/);

  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await page.getByRole('link', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/welcome\.html$/);
});


test('allows a new user to skip optional profile setup', async ({ page }) => {
  const profileSetup = new URL(
    '../../myprosole_app/design/mockups/profil-einrichten.html',
    import.meta.url,
  ).href;
  await page.goto(profileSetup);

  await page.getByRole('link', { name: 'Vorerst überspringen' }).click();

  await expect(page).toHaveURL(/home\.html$/);
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeHidden();
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await expect(page.getByText('Profil vervollständigen')).toBeVisible();
  await page.locator('a[href="profil-einrichten.html"]').click();
  await expect(page).toHaveURL(/profil-einrichten\.html$/);
});


test('offers profile setup after simulated Google registration', async ({ page }) => {
  await page.goto(mockupEntry);

  // Alle drei Kontowege muenden in die Anamnese; der Profil-Hinweis ist
  // trotzdem gesetzt und wartet auf der Startseite.
  await page.getByRole('link', { name: 'Mit Google fortfahren' }).click();

  await expect(page).toHaveURL(/anamnese\.html$/);
  await expect(page.getByText('Lass uns deinen Laufplan erstellen')).toBeVisible();

  await page.goto(mockupUrl('home.html'));
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt einrichten' }).click();
  await expect(page).toHaveURL(/profil-einrichten\.html$/);
});


test('allows profile setup to be postponed after simulated Facebook registration', async ({ page }) => {
  await page.goto(mockupEntry);

  await page.getByRole('link', { name: 'Mit Facebook fortfahren' }).click();

  await expect(page).toHaveURL(/anamnese\.html$/);
  await expect(page.getByText('Lass uns deinen Laufplan erstellen')).toBeVisible();

  await page.goto(mockupUrl('home.html'));
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeVisible();
  await page.getByRole('link', { name: 'Später', exact: true }).click();
  await expect(page).toHaveURL(/home\.html$/);
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeHidden();
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await expect(page.getByText('Profil vervollständigen')).toBeVisible();
});


test('supports app-only running and the optional insole connection path', async ({ page }) => {
  const home = new URL(
    '../../myprosole_app/design/mockups/home.html',
    import.meta.url,
  ).href;
  await page.goto(home);

  await expect(page.getByText('App-Modus · ohne Einlagen nutzbar')).toBeVisible();
  await expect(page.getByText('Einlage verbunden')).toHaveCount(0);
  await expect(page.getByText('Optional erweitern')).toHaveCount(0);
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await page.getByRole('link', { name: /Einlage verbinden/ }).click();

  await expect(page).toHaveURL(/einlage-verbinden\.html$/);
  await page.getByRole('link', { name: 'Was können die Einlagen?' }).click();
  await expect(page).toHaveURL(/einlagen-entdecken\.html$/);
  await expect(page.getByText('Du brauchst keine Einlagen, um Läufe aufzuzeichnen und die App zu verwenden.')).toBeVisible();
  await page.getByRole('link', { name: 'Ich habe bereits Einlagen' }).click();

  await expect(page).toHaveURL(/einlage-verbinden\.html$/);
  await page.getByRole('link', { name: /Suche starten/ }).click();
  await expect(page).toHaveURL(/einlage\.html$/);
  await expect(page.getByText('Verbunden', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Fertig' }).click();
  await expect(page).toHaveURL(/home\.html$/);
});


test('allows an existing user to reach the home screen through login', async ({ page }) => {
  await page.goto(mockupEntry);

  await page.getByRole('link', { name: /Ich habe bereits ein Konto/ }).click();
  await expect(page).toHaveURL(/login\.html$/);

  await page.getByLabel('E-Mail').fill('runner@example.test');
  await page.getByLabel('Passwort').fill('sicheres-testpasswort');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await expect(page).toHaveURL(/home\.html\??$/);
  await expect(page.getByText('Damit die Empfehlungen zu dir passen')).toBeHidden();
  await expect(page.getByText('Bereit für deinen nächsten Lauf?')).toBeVisible();
});


test('shows collapsible GPS analysis without biomechanical claims', async ({ page }) => {
  const gpsAnalysis = new URL(
    '../../myprosole_app/design/mockups/analyse-ergebnis.html?mode=gps',
    import.meta.url,
  ).href;
  await page.goto(gpsAnalysis);

  await expect(page.getByText('Deine Laufwerte', { exact: true })).toBeVisible();
  await expect(page.getByText('Mit Sensoreinlagen verfügbar')).toBeVisible();
  await expect(page.getByText('Biomechanik benötigt Sensoreinlagen')).toBeHidden();

  await page.getByText('Biomechanik-Analyse', { exact: true }).click();
  await expect(page.getByText('Biomechanik benötigt Sensoreinlagen')).toBeVisible();
  await expect(page.getByText('Sollen diese Daten deine Übungen personalisieren?')).toBeHidden();
});


test('asks once before insole data personalizes training', async ({ page }) => {
  const insoleAnalysis = new URL(
    '../../myprosole_app/design/mockups/analyse-ergebnis.html?mode=insole',
    import.meta.url,
  ).href;
  await page.goto(insoleAnalysis);

  await page.getByText('Biomechanik-Analyse', { exact: true }).click();
  await expect(page.getByText('Sollen diese Daten deine Übungen personalisieren?')).toBeVisible();
  await page.getByRole('button', { name: 'Ja, personalisieren' }).click();
  await expect(page.getByText('Personalisierung ist aktiviert')).toBeVisible();

  await page.reload();
  await page.getByText('Biomechanik-Analyse', { exact: true }).click();
  await expect(page.getByText('Sollen diese Daten deine Übungen personalisieren?')).toBeHidden();
  await expect(page.getByText('Personalisierung ist aktiviert')).toBeVisible();
});


test('creates a social-post draft from a locally selected run photo', async ({ page }) => {
  const analysis = new URL(
    '../../myprosole_app/design/mockups/analyse-ergebnis.html?mode=gps',
    import.meta.url,
  ).href;
  await page.goto(analysis);

  await page.getByRole('link', { name: 'Laufdaten teilen' }).click();
  await expect(page).toHaveURL(/share-export\.html\?source=data&from=analysis&mode=gps$/);
  await expect(page.getByText('Lauf teilen', { exact: true })).toBeVisible();
  await expect(page.getByText('Route und Laufwerte als Bild teilen')).toBeVisible();
  await expect(page.getByText('MYPROSOLE · KI-ENTWURF')).toBeHidden();
  await page.getByRole('link', { name: 'Zurück zum Laufergebnis' }).click();
  await expect(page).toHaveURL(/analyse-ergebnis\.html\?mode=gps$/);

  await page.getByRole('link', { name: 'Social-Post erstellen', exact: true }).click();
  await expect(page).toHaveURL(/social-studio\.html\?from=analysis&mode=gps$/);
  await expect(page.getByText('Aus deinem Foto wird ein Social-Post')).toBeVisible();
  await expect(page.getByText('Deine Laufdaten sind schon da: 8,2 km, 48:20 Minuten und 5:54 min\/km.')).toBeVisible();

  await page.getByLabel('Nachricht an den Social-Agenten').fill('Bitte modern und ohne großen Titel.');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(page.getByText('Bitte modern und ohne großen Titel.')).toBeVisible();
  await expect(page.getByText('Verstanden. Ich berücksichtige das beim Entwurf.')).toBeVisible();

  await page.locator('#social-photo').setInputFiles({
    name: 'kein-bild.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('kein bild'),
  });
  await expect(page.getByText('Dieses Dateiformat wird nicht unterstützt.')).toBeVisible();

  await page.locator('#social-photo').setInputFiles({
    name: 'laufbild.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByText('Bild lokal ausgewählt.')).toBeVisible();
  await page.getByRole('button', { name: 'Dynamisch' }).click();
  await page.getByRole('link', { name: 'Vorschau erstellen' }).click();

  await expect(page).toHaveURL(/share-export\.html\?source=ai&from=analysis&mode=gps$/);
  await expect(page.getByText('MYPROSOLE · KI-ENTWURF')).toBeVisible();
  await expect(page.getByText('PNG herunterladen')).toBeVisible();
  await page.getByRole('link', { name: 'Zurück zum Social-Studio' }).click();
  await expect(page).toHaveURL(/social-studio\.html\?from=analysis&mode=gps$/);
  await expect(page.getByText('Bild lokal ausgewählt.')).toHaveCount(0);
  await expect(page.getByText('Prototyp: Dein Foto bleibt auf diesem Gerät und wird nicht hochgeladen.')).toBeVisible();
  await page.getByRole('link', { name: 'Zurück zum Laufergebnis' }).click();
  await expect(page).toHaveURL(/analyse-ergebnis\.html\?mode=gps$/);
});


test('returns from the social studio to the post-run summary', async ({ page }) => {
  const summary = new URL(
    '../../myprosole_app/design/mockups/lauf-zusammenfassung.html',
    import.meta.url,
  ).href;
  await page.goto(summary);

  await page.getByRole('link', { name: 'Laufdaten teilen' }).click();
  await expect(page).toHaveURL(/share-export\.html\?source=data&from=summary$/);
  await page.getByRole('link', { name: 'Zurück zum Laufergebnis' }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html$/);

  await page.getByRole('link', { name: 'Social-Post erstellen', exact: true }).click();
  await expect(page).toHaveURL(/social-studio\.html\?from=summary$/);
  await page.getByRole('link', { name: 'Zurück zum Laufergebnis' }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html$/);
});


const SCREENS_WITH_BOTTOM_NAV = [
  'analyse-ergebnis.html',
  'home.html',
  'lauf-zusammenfassung.html',
  'profil.html',
  'uebungen.html',
  'verlauf.html',
];


// Die Navigationsleiste ist ein Bedienelement des Geraets, kein Teil des
// Inhalts. Sie gehoert immer an den unteren Bildschirmrand – auch nachdem
// jemand gescrollt hat. Kurze Screens zeigen Luecken darunter zuerst, lange
// Screens das Wegscrollen.
for (const height of [915, 1100]) {
  test(`keeps the bottom navigation at the screen edge at ${height}px height`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height });

    for (const screen of SCREENS_WITH_BOTTOM_NAV) {
      await page.goto(mockupUrl(screen));

      const before = await page.evaluate(() => {
        const nav = document.querySelector('.md-nav');
        if (!nav) return null;
        return {
          gap: window.innerHeight - nav.getBoundingClientRect().bottom,
          documentScrolls: document.documentElement.scrollHeight > window.innerHeight + 4,
        };
      });

      expect(before, `${screen} hat keine Navigationsleiste`).not.toBeNull();
      // Weder eine Luecke darunter noch ein Stueck unterhalb der Kante.
      expect(Math.abs(before!.gap), `${screen}: Leiste steht nicht an der Kante`)
        .toBeLessThanOrEqual(4);

      // Ganz nach unten scrollen. Die Leiste haengt am Bildschirm, nicht am
      // Inhalt – sie darf sich um keinen Pixel bewegen. Genau das war der
      // gemeldete Fehler.
      const after = await page.evaluate(async () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        const nav = document.querySelector('.md-nav')!;
        return {
          gap: window.innerHeight - nav.getBoundingClientRect().bottom,
          scrolled: window.scrollY,
          scrollable: document.documentElement.scrollHeight > window.innerHeight + 4,
        };
      });

      expect(Math.abs(after.gap), `${screen}: Leiste wandert beim Scrollen`)
        .toBeLessThanOrEqual(4);
      // Ist der Inhalt laenger als der Bildschirm, muss er auch scrollen –
      // sonst waere der Rest schlicht unerreichbar.
      if (after.scrollable) {
        expect(after.scrolled, `${screen}: der Inhalt laesst sich nicht scrollen`)
          .toBeGreaterThan(0);
      }

      // Der Kopf bleibt ebenfalls stehen – er traegt Titel und Rueckweg.
      const kopf = await page.evaluate(
        () => document.querySelector('.md-app-bar')!.getBoundingClientRect().top,
      );
      expect(Math.abs(kopf), `${screen}: der Kopf scrollt weg`).toBeLessThanOrEqual(4);

      // Der letzte Eintrag darf nicht dauerhaft unter der Leiste liegen.
      const verdeckt = await page.evaluate(() => {
        const stack = document.querySelector('.md-page-stack');
        if (!stack) return 0;
        const letztes = stack.lastElementChild;
        if (!letztes) return 0;
        const nav = document.querySelector('.md-nav')!.getBoundingClientRect();
        return letztes.getBoundingClientRect().bottom - nav.top;
      });
      expect(verdeckt, `${screen}: die Leiste verdeckt das letzte Element`)
        .toBeLessThanOrEqual(0);
    }
  });
}


test('keeps the chat FAB in the bottom-right corner, clear of the nav bar', async ({ page }) => {
  // Vormals zentriert ueber der Nav-Leiste (md-fab--nav-center), mit einer
  // eigenen 64px-Luecke zwischen zwei Nav-Items. Seit Community als fuenftes
  // Item dazukam, wurde die Luecke entfernt und der FAB in die Standard-Ecke
  // unten rechts verschoben (md-fab), damit alle fuenf Items gleich breit
  // bleiben.
  await page.setViewportSize({ width: 412, height: 1100 });
  await page.goto(mockupUrl('verlauf.html'));

  const gemessen = await page.evaluate(() => {
    const frame = document.querySelector('.device-frame')!.getBoundingClientRect();
    const nav = document.querySelector('.md-nav')!.getBoundingClientRect();
    const fab = document.querySelector('.md-fab')!.getBoundingClientRect();
    return {
      rechtsAbstand: frame.right - fab.right,
      liegtUeberNav: fab.bottom <= nav.top + 1,
    };
  });

  expect(gemessen.rechtsAbstand).toBeGreaterThanOrEqual(0);
  expect(gemessen.rechtsAbstand).toBeLessThanOrEqual(40);
  expect(gemessen.liegtUeberNav).toBe(true);
});


test('fills the welcome screen with the hero instead of empty space', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 1100 });
  await page.goto(mockupUrl('welcome.html'));

  const remaining = await page.evaluate(
    () => window.innerHeight - document.querySelector('.md-hero')!.getBoundingClientRect().bottom,
  );

  expect(remaining).toBeLessThanOrEqual(4);
});


test('offers the cycle calendar only after the matching profile answer', async ({ page }) => {
  await page.goto(mockupUrl('profil-einrichten.html'));
  await page.getByLabel('Wie dürfen wir dich nennen?').fill('Test Runner');
  await page.getByLabel('Geschlecht').selectOption('female');
  await page.getByLabel('Wie läufst du aktuell?').selectOption('recreational');
  await page.getByRole('button', { name: 'Profil übernehmen' }).click();
  await expect(page).toHaveURL(/home\.html\??$/);

  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await expect(page.getByText('Zykluskalender')).toBeVisible();
  await expect(page.getByText('Nicht eingerichtet')).toBeVisible();

  await page.getByRole('link', { name: /Zykluskalender/ }).click();
  await expect(page).toHaveURL(/zyklus-einrichten\.html$/);
  await expect(page.getByText('keine medizinische Bewertung')).toBeVisible();
  await expect(page.getByText(/willigst du in die Verarbeitung/)).toBeVisible();

  await page.getByRole('link', { name: /Regelmäßig/ }).click();
  await expect(page).toHaveURL(/zyklus-kalender\.html$/);
  await expect(page.getByText('Zyklustag 9 von 28')).toBeVisible();
  await expect(page.getByText(/Nächster Beginn voraussichtlich/)).toBeVisible();

  // Der Trainingsbezug wird erst nach der Einwilligung sichtbar.
  await page.getByRole('link', { name: 'Übungen ansehen' }).click();
  await expect(page).toHaveURL(/uebungen\.html$/);
  await expect(page.getByText(/Diese Auswahl berücksichtigt deine Zyklusphase/)).toBeVisible();
});


test('hides the cycle calendar for every other profile answer', async ({ page }) => {
  for (const answer of ['male', 'diverse', 'undisclosed']) {
    await page.goto(mockupUrl('profil-einrichten.html'));
    await page.getByLabel('Wie dürfen wir dich nennen?').fill('Test Runner');
    await page.getByLabel('Geschlecht').selectOption(answer);
    await page.getByLabel('Wie läufst du aktuell?').selectOption('recreational');
    await page.getByRole('button', { name: 'Profil übernehmen' }).click();

    await page.goto(mockupUrl('profil.html'));
    await expect(page.getByText('Zykluskalender')).toBeHidden();

    await page.goto(mockupUrl('uebungen.html'));
    await expect(page.getByText(/Diese Auswahl berücksichtigt deine Zyklusphase/)).toBeHidden();
  }
});


test('lets the cycle calendar be ended and its data deleted', async ({ page }) => {
  await page.goto(mockupUrl('profil-einrichten.html'));
  await page.getByLabel('Wie dürfen wir dich nennen?').fill('Test Runner');
  await page.getByLabel('Geschlecht').selectOption('female');
  await page.getByLabel('Wie läufst du aktuell?').selectOption('recreational');
  await page.getByRole('button', { name: 'Profil übernehmen' }).click();

  await page.goto(mockupUrl('zyklus-einrichten.html'));
  await page.getByRole('link', { name: /Unregelmäßig/ }).click();
  await expect(page).toHaveURL(/zyklus-kalender\.html$/);

  // Ohne Vorhersage: der unregelmaessige Zustand markiert keine kuenftigen Tage.
  await expect(page.getByText(/MyProSole sagt nichts voraus/)).toBeVisible();
  await expect(page.locator('.md-calendar__day--predicted:visible')).toHaveCount(0);

  await page.goto(mockupUrl('profil.html'));
  await expect(page.getByText('Aktiv')).toBeVisible();

  await page.goto(mockupUrl('zyklus-kalender.html'));
  await page.getByRole('link', { name: 'Kalender beenden und Daten löschen' }).click();
  await expect(page).toHaveURL(/profil\.html$/);
  await expect(page.getByText('Nicht eingerichtet')).toBeVisible();

  // Der Trainingsbezug verschwindet mit der widerrufenen Einwilligung.
  await page.goto(mockupUrl('uebungen.html'));
  await expect(page.getByText(/Diese Auswahl berücksichtigt deine Zyklusphase/)).toBeHidden();
});


test('shows the post-run summary in both insole states', async ({ page }) => {
  // Ohne Einlagen: unveraendert der App-only-Zustand. from=tracking, weil der
  // Einlagen-Hinweis nur unmittelbar nach dem Lauf erscheint.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await expect(page.getByText('App-Modus mit GPS')).toBeVisible();
  await expect(page.getByText('Deine Lauftechnik')).toBeHidden();

  // Mit Einlagen: dieselben GPS-Werte, zusaetzlich die Technikdaten.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?mode=insole'));
  await expect(page.getByText('Mit Sensoreinlagen aufgezeichnet')).toBeVisible();
  await expect(page.getByText('Deine Lauftechnik')).toBeVisible();
  await expect(page.getByText('Einlage verbunden')).toBeVisible();

  // Die GPS-Kennzahlen bleiben in beiden Zustaenden dieselben.
  await expect(page.getByText('8,2 km', { exact: true })).toBeVisible();
  await expect(page.getByText('48:20 min', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Laufanalyse anschauen' }).click();
  await expect(page).toHaveURL(/analyse-ergebnis\.html\?mode=insole$/);
  await expect(page.getByText('Biomechanik-Analyse')).toBeVisible();
});


test('reaches the run analysis from the summary in the matching mode', async ({ page }) => {
  // Ohne Einlagen führt derselbe Knopf in die GPS-Analyse.
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  await page.getByRole('link', { name: 'Laufanalyse anschauen' }).click();
  await expect(page).toHaveURL(/analyse-ergebnis\.html\?mode=gps$/);
  await expect(page.getByText('Mit Sensoreinlagen verfügbar')).toBeVisible();
  await expect(page.getByText('Heute, 07:42 Uhr · 8,2 km · 48:20 min · 5:54 min/km')).toBeVisible();
});


test('guides the runner through the micro routine after a run', async ({ page }) => {
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));

  // Das Ergebnis ist sichtbar, bevor die Routine angeboten wird.
  await expect(page.getByText('Lauf gespeichert')).toBeVisible();
  await expect(page.getByText('Deine Mikroroutine')).toBeVisible();

  await page.getByRole('link', { name: 'Starten' }).click();
  await expect(page).toHaveURL(/trainingseinheit\.html\?schritt=1$/);
  await expect(page.getByText('Übung 1 von 3')).toBeVisible();
  await expect(page.getByText('Standing Hip Abduction')).toBeVisible();
  await expect(page.getByText('2 Sätze · 15 Wiederholungen pro Seite')).toBeVisible();

  await page.getByRole('link', { name: 'Weiter' }).click();
  await expect(page.getByText('Übung 2 von 3')).toBeVisible();
  await page.getByRole('link', { name: 'Weiter' }).click();
  await expect(page.getByText('Übung 3 von 3')).toBeVisible();

  await page.getByRole('link', { name: 'Einheit abschließen' }).click();
  await expect(page.getByText('Einheit erledigt')).toBeVisible();

  await page.getByRole('link', { name: 'Zum Wochenplan' }).click();
  await expect(page).toHaveURL(/uebungen\.html$/);
  // Derselbe Sonntag steht dreimal im Markup, sichtbar ist nur der erledigte.
  await expect(page.locator('[data-routine-state="done"]:visible')).toHaveCount(1);
  await expect(page.locator('[data-routine-state="open"]:visible')).toHaveCount(0);
  await expect(page.getByText('Regenerationslauf · 8,2 kmMikroroutine erledigt')).toBeVisible();
});


test('keeps a skipped routine open in the week plan', async ({ page }) => {
  await page.goto(mockupUrl('uebungen.html'));
  await expect(page.getByText('Mikroroutine offen')).toBeVisible();

  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await page.getByRole('link', { name: 'Heute nicht' }).click();

  await expect(page).toHaveURL(/uebungen\.html$/);
  await expect(page.getByText('heute übersprungen')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nachholen' })).toBeVisible();

  // Das Angebot kommt nicht erneut, die Entscheidung gilt fuer heute.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await expect(page.getByText('Deine Mikroroutine')).toBeHidden();

  await page.goto(mockupUrl('uebungen.html'));
  await page.getByRole('link', { name: 'Nachholen' }).click();
  await expect(page).toHaveURL(/trainingseinheit\.html\?schritt=1$/);
});


test('keeps the chat composer on screen and inside the frame', async ({ page }) => {
  // Telefonformat: hier fiel auf, dass die Eingabezeile mehrere hundert Pixel
  // unter dem Bildschirm lag und der Senden-Knopf abgeschnitten war.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(mockupUrl('chat.html'));

  const messen = () =>
    page.evaluate(() => {
      const row = document.querySelector('.md-chat-input-row')!.getBoundingClientRect();
      const send = document.querySelector('.md-chat-send')!.getBoundingClientRect();
      return {
        rowBottom: row.bottom,
        rowTop: row.top,
        sendRight: send.right,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    });

  const oben = await messen();
  // Die Eingabezeile steht am unteren Rand, nicht darunter.
  expect(Math.abs(oben.rowBottom - oben.height)).toBeLessThanOrEqual(4);
  // Kein Teil der Zeile wird vom Rahmen abgeschnitten.
  expect(oben.sendRight).toBeLessThanOrEqual(oben.width);

  // Bis ans Ende scrollen: die Eingabezeile haengt am Bildschirm und bleibt.
  await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((done) => requestAnimationFrame(() => done(null)));
  });
  const unten = await messen();
  expect(Math.abs(unten.rowBottom - unten.height)).toBeLessThanOrEqual(4);

  // Die letzte Nachricht darf nicht dauerhaft hinter der Eingabezeile liegen.
  const verdeckt = await page.evaluate(() => {
    const log = document.querySelector('.md-chat-log')!;
    const letzte = log.lastElementChild!.getBoundingClientRect();
    const row = document.querySelector('.md-chat-input-row')!.getBoundingClientRect();
    return letzte.bottom - row.top;
  });
  expect(verdeckt).toBeLessThanOrEqual(0);
});


test('looks the same on a phone in dark mode as on the desktop', async ({ page }) => {
  // Waehrend das Design abgestimmt wird, darf die Systemeinstellung des
  // Geraets die Farben nicht veraendern – sonst zeigt das Telefon etwas
  // anderes als der Bildschirm, auf dem entschieden wird.
  const fabColour = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector('.device-frame')!).backgroundColor,
    );

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  const light = await fabColour();

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  const systemDark = await fabColour();

  expect(light).toBe('rgb(248, 249, 251)');
  expect(systemDark).toBe(light);

  // "only" ist die ausdrueckliche Absage an das algorithmische Abdunkeln,
  // das Chrome und Samsung Internet auf Android sonst auf jede helle Seite
  // anwenden. Ohne das Schluesselwort dunkeln sie trotzdem ab.
  const scheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  // Die Reihenfolge normalisiert der Browser selbst, deshalb beide Wörter
  // einzeln pruefen statt der geschriebenen Schreibweise.
  expect(scheme.split(/\s+/).sort()).toEqual(['light', 'only']);
});


test('keeps the dark theme available as an explicit choice', async ({ page }) => {
  // Die dunklen Werte bleiben vollstaendig erhalten. Sie greifen nur noch,
  // wenn sie ausdruecklich gesetzt werden – spaeter ueber eine Einstellung.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

  // Der Rahmen, nicht der Chat-Knopf: der traegt inzwischen feste Markenfarben
  // und aendert sich mit dem Thema absichtlich nicht mehr.
  const chosenDark = await page.evaluate(
    () => getComputedStyle(document.querySelector('.device-frame')!).backgroundColor,
  );
  expect(chosenDark).toBe('rgb(13, 15, 22)');
});


test('offers the routine only right after the run, not when looking back', async ({ page }) => {
  // Frisch beendet: Angebot, kein Zustand.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await expect(page.getByText('Deine Mikroroutine')).toBeVisible();
  await expect(page.getByText('Mikroroutine nicht erledigt')).toBeHidden();

  // Denselben Lauf spaeter aus Home geoeffnet: kein Angebot, sondern der
  // Zustand. Ein Angebot zu einem Lauf von gestern waere sinnlos.
  await page.goto(mockupUrl('home.html'));
  await page.getByRole('link', { name: /Letzter Lauf/ }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html$/);
  await expect(page.getByText('Deine Mikroroutine')).toBeHidden();
  await expect(page.getByText('Mikroroutine nicht erledigt')).toBeVisible();

  await page.getByRole('link', { name: 'Nachholen' }).click();
  await expect(page).toHaveURL(/trainingseinheit\.html\?schritt=1$/);
});


test('shows the routine as done when looking back after completing it', async ({ page }) => {
  await page.goto(mockupUrl('trainingseinheit.html?schritt=fertig'));
  await expect(page.getByText('Einheit erledigt')).toBeVisible();

  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  await expect(page.getByText('Mikroroutine erledigt')).toBeVisible();
  await expect(page.getByText('Mikroroutine nicht erledigt')).toBeHidden();
  await expect(page.getByText('Deine Mikroroutine')).toBeHidden();
});


test('keeps the insole promo on the run analysis, not the summary', async ({ page }) => {
  // Der Hinweis "Mehr Daten moeglich" lenkte auf der Zusammenfassung vom
  // Ergebnis ab und stand inhaltlich ohnehin schon in der Laufanalyse -
  // jetzt lebt er nur noch dort, eingeklappt hinter der Biomechanik-Analyse.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toHaveCount(0);
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toHaveCount(0);

  await page.goto(mockupUrl('analyse-ergebnis.html?mode=gps'));
  const promo = page.getByText('Biomechanik benötigt Sensoreinlagen');
  await expect(promo).toBeHidden();
  await page.getByText('Biomechanik-Analyse').click();
  await expect(promo).toBeVisible();
});


test('opens the side menu for self-made plans from the exercise tab', async ({ page }) => {
  // Telefonbreite: nur dort fuellt der Rahmen den Bildschirm, sodass ein Tipp
  // neben das Menue auch wirklich den Scrim trifft.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(mockupUrl('uebungen.html'));

  const drawer = page.locator('.md-drawer');
  await expect(drawer).toBeHidden();

  await page.getByRole('link', { name: 'Mehr: eigene Trainingspläne' }).click();
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gym-Trainingsplan erstellen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trainingstagebuch' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lauftraining selbst erstellen' })).toBeVisible();

  // Schliessen ueber das Symbol im Kopf des Menues.
  await page.getByRole('link', { name: 'Menü schließen' }).nth(1).click();
  await expect(drawer).toBeHidden();

  // Und durch Tippen neben das Menue.
  await page.getByRole('link', { name: 'Mehr: eigene Trainingspläne' }).click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(40, 400);
  await expect(drawer).toBeHidden();
});


test('starts the guided session from a video-led entry', async ({ page }) => {
  await page.goto(mockupUrl('uebungen.html'));

  const entry = page.locator('.md-routine-start');
  await expect(entry).toBeVisible();
  await expect(entry.locator('.md-video-placeholder')).toBeVisible();
  await expect(page.getByText('mit Videoanleitung')).toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(/trainingseinheit\.html\?schritt=1$/);
  // Je Schritt einer im Markup, sichtbar ist der des aktuellen Schritts.
  await expect(page.locator('.md-video-placeholder:visible')).toHaveCount(1);
});


test('logs a training entry in three taps and opens a past entry from the history', async ({ page }) => {
  await page.goto(mockupUrl('uebungen.html'));
  await page.getByRole('link', { name: 'Mehr: eigene Trainingspläne' }).click();
  await page.getByRole('link', { name: 'Trainingstagebuch' }).click();
  await expect(page).toHaveURL(/trainingstagebuch\.html$/);

  // Vorbelegt aus dem Lauf, kein leeres Formular. Tempo steht gleichrangig
  // daneben statt unter "Mehr Details" versteckt.
  await expect(page.getByText('Aus deinem Lauf übernommen')).toBeVisible();
  await expect(page.getByText('8,2 km', { exact: true })).toBeVisible();
  await expect(page.getByText('48:20 min', { exact: true })).toBeVisible();
  await expect(page.getByText('5:54 min/km', { exact: true })).toBeVisible();

  // Der Normalfall: bewerten und speichern.
  // Das Radio ist visuell versteckt; getippt wird auf das umschliessende
  // Label. "Ging so" steht auch in den letzten Einträgen, daher eingegrenzt.
  await page.locator('.md-rating').getByText('Ging so').click();
  await expect(page.getByRole('radio', { name: 'Ging so' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Eintrag speichern' })).toBeVisible();

  // Vergangene Einträge sind anklickbar und führen auf ihre Zusammenfassung.
  await page.getByRole('link', { name: /12,1 km · 63:02 min/ }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html$/);
});


test('shows heart rate live-tracking only with a connected smartwatch', async ({ page }) => {
  await page.goto(mockupUrl('live-tracking.html'));
  await expect(page.getByText('4,8', { exact: true })).toBeVisible();
  await expect(page.getByText('bpm')).toBeHidden();

  await page.goto(mockupUrl('live-tracking.html?smartwatch=verbunden'));
  await expect(page.getByText('bpm')).toBeVisible();
  await expect(page.getByText('142', { exact: true })).toBeVisible();
});


test('prompts for the training diary right after stopping a run, with a skip', async ({ page }) => {
  // Ueber "Mehr" aufgerufen ist das Formular bereits der kurze Weg - kein
  // zusaetzlicher Ausweg noetig.
  await page.goto(mockupUrl('trainingstagebuch.html'));
  await expect(page.getByRole('link', { name: 'Später eintragen' })).toBeHidden();

  // Direkt nach dem Lauf: Ueberspringen fuehrt in die Zusammenfassung, nicht
  // in den Wochenplan - die Mikroroutine dort wartet noch.
  await page.goto(mockupUrl('trainingstagebuch.html?from=tracking'));
  await expect(page.getByText('Aus deinem Lauf übernommen')).toBeVisible();
  await page.getByRole('link', { name: 'Später eintragen' }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html\?from=tracking$/);
  await expect(page.getByText('Deine Mikroroutine')).toBeVisible();

  // Wer stattdessen speichert, landet ebenfalls dort statt im Wochenplan.
  await page.goto(mockupUrl('trainingstagebuch.html?from=tracking'));
  await page.locator('.md-rating').getByText('Gut').click();
  await page.getByRole('button', { name: 'Eintrag speichern' }).click();
  await expect(page).toHaveURL(/lauf-zusammenfassung\.html\?.*from=tracking/);
  await expect(page.getByText('Deine Mikroroutine')).toBeVisible();
});


test('asks where and from which kilometre only when there was pain', async ({ page }) => {
  await page.goto(mockupUrl('trainingstagebuch.html'));

  const details = page.locator('.md-diary__pain-details');
  await expect(details).toBeHidden();

  // Kein Schmerz: die Rueckfragen bleiben weg, ein Tipp genuegt.
  await page.locator('.md-diary__pain').getByText('Nein').click();
  await expect(page.getByRole('radio', { name: 'Nein' })).toBeChecked();
  await expect(details).toBeHidden();

  await page.locator('.md-diary__pain').getByText('Ja', { exact: true }).click();
  await expect(details).toBeVisible();
  await expect(page.getByLabel('Ab welchem Kilometer ungefähr?')).toBeVisible();
  await page.getByLabel('Ab welchem Kilometer ungefähr?').fill('6');
  await page.getByText('Knie', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Knie' })).toBeChecked();

  // Speichern bleibt jederzeit erreichbar.
  await expect(page.getByRole('button', { name: 'Eintrag speichern' })).toBeVisible();
});


test('shows kilometres and record only after the community stats switch is on', async ({ page }) => {
  await page.goto(mockupUrl('community-profil.html'));

  const preview = page.getByText('So sehen es andere');
  const schalter = page.locator('#stats-sichtbar');
  await expect(preview).toBeHidden();
  await expect(schalter).not.toBeChecked();

  // Wie bei "Dunkles Design": der sichtbare Toggle liegt ueber dem
  // versteckten Checkbox-Eingang, deshalb ueber den Zeilentext klicken statt
  // .check() direkt auf das <input>.
  await page.getByText('Kilometer & Rekord zeigen').click();
  await expect(schalter).toBeChecked();
  await expect(preview).toBeVisible();
  await expect(page.getByText('412', { exact: false })).toBeVisible();
  await expect(page.getByText('48:20 min', { exact: false })).toBeVisible();

  // Aus, nicht an: zurueckschalten versteckt die Vorschau wieder sofort.
  await page.getByText('Kilometer & Rekord zeigen').click();
  await expect(schalter).not.toBeChecked();
  await expect(preview).toBeHidden();
});


test('reveals the free-text sport field only after choosing "+ Andere"', async ({ page }) => {
  await page.goto(mockupUrl('community-profil.html'));

  const freitext = page.getByLabel('Weitere Sportart');
  await expect(freitext).toBeHidden();

  await page.getByText('+ Andere').click();
  await expect(freitext).toBeVisible();
});


test('reveals the meeting-point field only after the toggle is on', async ({ page }) => {
  await page.goto(mockupUrl('community-neuer-beitrag.html'));

  const treffpunkt = page.getByLabel('Treffpunkt', { exact: true });
  await expect(treffpunkt).toBeHidden();

  await page.getByText('Treffpunkt hinzufügen').click();
  await expect(treffpunkt).toBeVisible();
});


test('lets the ZusammenLauf radius be changed via a real filter screen', async ({ page }) => {
  await page.goto(mockupUrl('community-zusammenlauf.html'));
  await page.getByText('Ändern').click();
  await expect(page).toHaveURL(/community-zusammenlauf-filter\.html$/);

  const fuenf = page.getByRole('radio', { name: '5 km', exact: true });
  const zehn = page.getByRole('radio', { name: '10 km' });
  await expect(fuenf).toBeChecked();
  await expect(zehn).not.toBeChecked();

  // Umkreis ist eine Einzelauswahl: der neue Wert ersetzt den alten.
  await page.getByText('10 km', { exact: true }).click();
  await expect(zehn).toBeChecked();
  await expect(fuenf).not.toBeChecked();
});


test('opens a real Google Maps link for a posted meeting point', async ({ page }) => {
  await page.goto(mockupUrl('community.html'));

  const standort = page.getByRole('link', { name: 'Park Süd, München' });
  await expect(standort).toHaveAttribute('href', /google\.com\/maps\/search/);
  await expect(standort).toHaveAttribute('target', '_blank');
});


test('lets a plan suggestion be accepted or declined one at a time', async ({ page }) => {
  await page.goto(mockupUrl('uebungen.html'));
  await page.getByRole('link', { name: 'Mehr: eigene Trainingspläne' }).click();
  await page.getByRole('link', { name: 'Gym-Trainingsplan erstellen' }).click();
  await expect(page).toHaveURL(/gym-plan\.html$/);

  // Vorausgefüllt, und der Hinweis haelt niemanden auf.
  await expect(page.locator('.md-plan-item:visible')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Plan speichern' })).toBeVisible();
  await expect(page.getByText('In deinem Plan fehlt etwas')).toBeHidden();

  await page.getByText('MyProSole hat einen Hinweis').click();
  await expect(page.getByText('In deinem Plan fehlt etwas für die Beweglichkeit.')).toBeVisible();

  await page.getByRole('link', { name: 'Übernehmen', exact: true }).click();
  await expect(page).toHaveURL(/gym-plan\.html\?vorschlag=uebernommen$/);
  await expect(page.locator('.md-plan-item:visible')).toHaveCount(4);
  await expect(page.getByText('Wadenmobilisation an der Wand')).toBeVisible();
  await expect(page.getByText('Vorschlag übernommen')).toBeVisible();

  // Ablehnen aendert den Plan nicht.
  await page.goto(mockupUrl('gym-plan.html?vorschlag=abgelehnt'));
  await expect(page.locator('.md-plan-item:visible')).toHaveCount(3);
  await expect(page.getByText('Alles klar, bleibt wie es ist.')).toBeVisible();
});


test('never lets the device frame scroll sideways', async ({ page }) => {
  // Gefunden im Trainingstagebuch: die versteckten Auswahlfelder waren
  // absolut positioniert, ohne dass ihr Chip positioniert war. Damit landeten
  // sie beim Geräterahmen, zogen ihn auf 652px und beim Fokussieren scrollte
  // er 240px zur Seite – wegen overflow:hidden ohne Weg zurück.
  await page.setViewportSize({ width: 412, height: 915 });

  const screens = [
    'trainingstagebuch.html',
    'gym-plan.html',
    'uebungen.html',
    'trainingseinheit.html',
    'zyklus-kalender.html',
    'profil-einrichten.html',
    // Gefunden in Gruppen: body.md-screen ist display:grid ohne eigene
    // grid-template-columns, also eine implizite "auto"-Spalte, die sich am
    // Max-Content ihres Inhalts bemisst statt an der Grid-Breite. Fuenf
    // Filter-Chips zusammen breiter als ein Telefon zogen dadurch die ganze
    // Seite in die Breite. Community-Screens deshalb ausdruecklich mit drin.
    'community.html',
    'community-zusammenlauf.html',
    'community-zusammenlauf-filter.html',
    'community-gruppen.html',
    'community-gruppe-detail.html',
    'community-gruppe-erstellen.html',
    'community-beitrag.html',
    'community-neuer-beitrag.html',
    'community-profil.html',
    'community-meine-gruppen.html',
  ];

  for (const screen of screens) {
    await page.goto(mockupUrl(screen));
    const gemessen = await page.evaluate(() => {
      const frame = document.querySelector('.device-frame')!;
      return {
        breite: frame.clientWidth,
        inhalt: frame.scrollWidth,
        // Am Telefon steht .device-frame auf overflow:visible (fuer die
        // geheftete App-Leiste, siehe components.css). Damit meldet sein
        // eigenes scrollWidth keinen Ueberlauf mehr, obwohl visuell
        // entkommender Inhalt (z.B. ein <fieldset> mit langer <legend>,
        // die eine eigene, vom Flex-Wrap unabhaengige Mindestbreite hat)
        // die ganze Seite seitlich scrollbar macht. Deshalb zusaetzlich
        // gegen die tatsaechliche Seitenbreite pruefen.
        seite: document.documentElement.scrollWidth,
        fenster: window.innerWidth,
      };
    });
    expect(gemessen.inhalt, `${screen} ist innen breiter als der Rahmen`)
      .toBeLessThanOrEqual(gemessen.breite + 1);
    expect(gemessen.seite, `${screen} laesst die ganze Seite seitlich scrollen`)
      .toBeLessThanOrEqual(gemessen.fenster + 1);
  }

  // Und auch nicht, nachdem ein Element in einer scrollenden Reihe den Fokus
  // bekommt – dort trat der Fehler auf.
  await page.goto(mockupUrl('trainingstagebuch.html'));
  await page.locator('.md-diary__pain').getByText('Ja', { exact: true }).click();
  await page.locator('.md-chip-set').getByText('Woanders').click();
  const versatz = await page.evaluate(
    () => document.querySelector('.device-frame')!.scrollLeft,
  );
  expect(versatz).toBe(0);
});

// Gefunden in Community: Feed und ZusammenLauf tragen ein Such-Icon in der
// App-Leiste, Gruppen nicht (echtes Suchfeld stattdessen). Ohne eigene
// Mindesthoehe richtet sich .md-app-bar nach ihrem hoechsten Kind - mit
// Icon-Knopf (40px) 72px hoch, ohne nur rund 62px. Der Titel "Community"
// sass dadurch beim Tab-Wechsel auf zwei verschiedenen Hoehen und wirkte
// wie ein Sprung, obwohl gar nichts animierte.
test('keeps the Community app bar the same height across all three tabs', async ({ page }) => {
  const hoehen: number[] = [];
  for (const screen of ['community.html', 'community-zusammenlauf.html', 'community-gruppen.html']) {
    await page.goto(mockupUrl(screen));
    hoehen.push(
      await page.evaluate(() => document.querySelector('.md-app-bar')!.getBoundingClientRect().height),
    );
  }
  expect(hoehen[1], 'ZusammenLauf-Leiste weicht von der Feed-Leiste ab').toBe(hoehen[0]);
  expect(hoehen[2], 'Gruppen-Leiste weicht von der Feed-Leiste ab').toBe(hoehen[0]);
});

test('offers free text only when the listed places do not fit', async ({ page }) => {
  await page.goto(mockupUrl('trainingstagebuch.html'));
  await page.locator('.md-diary__pain').getByText('Ja', { exact: true }).click();

  const freitext = page.locator('.md-diary__pain-free');
  await expect(freitext).toBeHidden();

  await page.locator('.md-chip-set').getByText('Woanders').click();
  await expect(freitext).toBeVisible();
  await expect(page.getByLabel('Beschreib es kurz')).toBeVisible();

  // Ehrlich beschriftet: der Freitext steuert die Auswahl nicht.
  await expect(page.getByText(/Die automatische Übungsauswahl richtet sich nach den Feldern darüber/)).toBeVisible();
});


test('shows the weekly jump live while editing the running plan', async ({ page }) => {
  await page.goto(mockupUrl('uebungen.html'));
  await page.getByRole('link', { name: 'Mehr: eigene Trainingspläne' }).click();
  await page.getByRole('link', { name: 'Lauftraining selbst erstellen' }).click();
  await expect(page).toHaveURL(/laufplan\.html$/);

  const summe = page.locator('[data-week-sum]');
  const stufe = () => summe.getAttribute('data-week-level');

  // Vorbelegt, nicht leer, und der Sprung ist beziffert.
  await expect(page.locator('[data-week-total]')).toHaveText('36');
  await expect(page.locator('[data-week-delta]')).toHaveText('+14 %');
  expect(await stufe()).toBe('caution');

  // Deutlich mehr: die Farbe schlaegt um, aber nichts wird gesperrt.
  await page.fill('#km-sa', '20');
  await expect(page.locator('[data-week-total]')).toHaveText('44');
  expect(await stufe()).toBe('high');
  await expect(page.getByRole('link', { name: 'Plan speichern' })).toBeEnabled();
  await expect(page.getByText('Warnung')).toHaveCount(0);

  // Kleinere Woche: wieder ruhig.
  await page.fill('#km-sa', '8');
  await page.fill('#km-so', '4');
  await expect(page.locator('[data-week-delta]')).toHaveText('-8 %');
  expect(await stufe()).toBe('calm');
});


test('says so instead of doing nothing when a control is not designed yet', async ({ page }) => {
  // href="" zeigt auf die eigene Adresse: der Screen lud sich neu und sah aus
  // wie ein Flackern. Nichts zu tun waere genauso schlecht – in einer
  // Testrunde wird daraus die Meldung "der Knopf ist kaputt".
  await page.goto(mockupUrl('profil.html'));
  await page.evaluate(() => {
    (window as unknown as { marke?: boolean }).marke = true;
  });

  await page.getByText('Rechnungen').click();

  const nochDieselbeSeite = await page.evaluate(
    () => (window as unknown as { marke?: boolean }).marke === true,
  );
  expect(nochDieselbeSeite, 'der Screen hat sich neu geladen').toBe(true);

  const hinweis = page.locator('.md-snackbar');
  await expect(hinweis).toHaveText('Dieser Teil ist im Entwurf noch nicht angelegt.');
  await expect(hinweis).toHaveClass(/md-snackbar--visible/);

  // Sie verschwindet von selbst und liegt nicht dauerhaft im Weg.
  await expect(hinweis).not.toHaveClass(/md-snackbar--visible/, { timeout: 5000 });
});


test('leaves working links untouched', async ({ page }) => {
  // Die Erkennung darf nichts einfangen, was funktioniert.
  await page.goto(mockupUrl('home.html'));
  await expect(page.getByRole('link', { name: /Laufen starten/ })).not.toHaveAttribute(
    'data-entwurf-offen',
    '',
  );
  await page.getByRole('link', { name: /Laufen starten/ }).click();
  await expect(page).toHaveURL(/live-tracking\.html$/);
});


test('counts the controls that are not designed yet', async ({ page }) => {
  // Der Zaehler haelt fest, wovon docs/offene-bedienelemente.md spricht.
  // Weicht er ab, wurde entweder etwas nachgezogen – dann gehoert die Liste
  // fortgeschrieben – oder ein neues Element ohne Ziel ist hinzugekommen.
  const erwartet: Record<string, number> = {
    'chat.html': 3,
    'einlage.html': 2,
    'gym-plan.html': 5,
    'home.html': 1,
    'live-tracking.html': 1,
    'login.html': 1,
    'profil.html': 10,
    'share-export.html': 3,
    'verlauf.html': 5,
    'zyklus-kalender.html': 1,
  };

  let gesamt = 0;
  for (const [screen, anzahl] of Object.entries(erwartet)) {
    await page.goto(mockupUrl(screen));
    await expect(page.locator('[data-entwurf-offen]'), screen).toHaveCount(anzahl);
    gesamt += anzahl;
  }
  expect(gesamt).toBe(32);
});


test('switches to the dark design from the profile and keeps it across screens', async ({ page }) => {
  await page.goto(mockupUrl('profil.html'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Angetippt wird die Zeile, nicht das Kaestchen – das ist unsichtbar und
  // faengt bewusst keine Beruehrung ab.
  const schalter = page.locator('#dunkles-design');
  await expect(schalter).not.toBeChecked();
  await page.getByText('Dunkles Design').click();
  await expect(schalter).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Die Flaeche dreht sich, die Markenfarben nicht.
  const flaeche = await page.evaluate(
    () => getComputedStyle(document.querySelector('.device-frame')!).backgroundColor,
  );
  expect(flaeche).toBe('rgb(13, 15, 22)');

  // Die Wahl gilt auf jedem weiteren Screen, ohne dass er hell aufblitzt.
  await page.getByRole('link', { name: 'Start' }).click();
  await expect(page).toHaveURL(/home\.html$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Was auf einem Foto liegt, dreht sich nicht mit.
  await page.goto(mockupUrl('welcome.html'));
  const schleier = await page.evaluate(
    () => getComputedStyle(document.querySelector('.md-hero__scrim')!).backgroundColor,
  );
  expect(schleier).toBe('rgb(22, 33, 62)');

  // Und wieder zurueck.
  await page.goto(mockupUrl('profil.html'));
  await expect(page.locator('#dunkles-design')).toBeChecked();
  await page.getByText('Dunkles Design').click();
  await expect(page.locator('#dunkles-design')).not.toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});


test('never paints an icon black where the page is dark', async ({ page }) => {
  // Symbole ohne die Klasse .icon blieben beim Standardwert Schwarz. Im
  // hellen Thema faellt das nicht auf, im dunklen verschwanden sie – die
  // gesamte untere Navigationsleiste war betroffen.
  for (const screen of ['home.html', 'verlauf.html', 'uebungen.html', 'profil.html']) {
    await page.goto(mockupUrl(screen));
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });

    const schwarze = await page.evaluate(() =>
      [...document.querySelectorAll('.md-nav svg, .md-app-bar svg')].filter(
        (el) => getComputedStyle(el).fill === 'rgb(0, 0, 0)',
      ).length,
    );
    expect(schwarze, `${screen}: schwarze Symbole im dunklen Design`).toBe(0);
  }
});


test('keeps the logo blue on the start buttons in both themes', async ({ page }) => {
  const BLAU = 'rgb(67, 175, 216)';

  for (const modus of ['light', 'dark']) {
    await page.goto(mockupUrl('home.html'));
    await page.evaluate((m) => {
      document.documentElement.dataset.theme = m;
    }, modus);
    const cta = await page.evaluate(
      () => getComputedStyle(document.querySelector('.md-cta')!).backgroundColor,
    );
    expect(cta, `Startknopf im Modus ${modus}`).toBe(BLAU);

    await page.goto(mockupUrl('uebungen.html'));
    await page.evaluate((m) => {
      document.documentElement.dataset.theme = m;
    }, modus);
    const einheit = await page.evaluate(
      () => getComputedStyle(document.querySelector('.md-routine-start__body')!).backgroundColor,
    );
    expect(einheit, `Uebungsknopf im Modus ${modus}`).toBe(BLAU);
  }
});
