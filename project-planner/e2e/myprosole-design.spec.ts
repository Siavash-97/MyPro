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

  await expect(page).toHaveURL(/home\.html\?#profil-hinweis$/);
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeVisible();
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
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeHidden();
  await page.getByLabel('Profil').click();
  await expect(page).toHaveURL(/profil\.html$/);
  await expect(page.getByText('Profil vervollständigen')).toBeVisible();
  await page.locator('a[href="profil-einrichten.html"]').click();
  await expect(page).toHaveURL(/profil-einrichten\.html$/);
});


test('offers profile setup after simulated Google registration', async ({ page }) => {
  await page.goto(mockupEntry);

  await page.getByRole('link', { name: 'Mit Google fortfahren' }).click();

  await expect(page).toHaveURL(/home\.html#profil-hinweis$/);
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt einrichten' }).click();
  await expect(page).toHaveURL(/profil-einrichten\.html$/);
});


test('allows profile setup to be postponed after simulated Facebook registration', async ({ page }) => {
  await page.goto(mockupEntry);

  await page.getByRole('link', { name: 'Mit Facebook fortfahren' }).click();

  await expect(page).toHaveURL(/home\.html#profil-hinweis$/);
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeVisible();
  await page.getByRole('link', { name: 'Später', exact: true }).click();
  await expect(page).toHaveURL(/home\.html$/);
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeHidden();
  await page.getByLabel('Profil').click();
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
  await page.getByLabel('Profil').click();
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
  await expect(page.getByText('Mach MyProSole zu deiner App')).toBeHidden();
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


// Der FAB ist absolut am unteren Rahmenrand verankert, die Navigationsleiste
// steht im normalen Fluss. Ist der Rahmen hoeher als sein Inhalt, driften
// beide auseinander und die Leiste haengt mitten im Bild. Kurze Screens wie
// verlauf.html zeigen das zuerst, hohe Displays betreffen alle.
for (const height of [915, 1100]) {
  test(`keeps the bottom navigation at the screen edge at ${height}px height`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height });

    for (const screen of SCREENS_WITH_BOTTOM_NAV) {
      await page.goto(mockupUrl(screen));

      const gap = await page.evaluate(() => {
        const nav = document.querySelector('.md-nav');
        if (!nav) return null;
        return window.innerHeight - nav.getBoundingClientRect().bottom;
      });

      expect(gap, `${screen} hat keine Navigationsleiste`).not.toBeNull();
      // Laengere Screens scrollen, die Leiste darf unterhalb des Falzes liegen.
      // Eine Luecke oberhalb der Bildschirmkante darf nie entstehen.
      expect(gap!, `${screen} laesst eine Luecke unter der Navigationsleiste`).toBeLessThanOrEqual(4);
    }
  });
}


test('keeps the chat FAB centred on the navigation bar', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 1100 });
  await page.goto(mockupUrl('verlauf.html'));

  const offset = await page.evaluate(() => {
    const nav = document.querySelector('.md-nav')!.getBoundingClientRect();
    const fab = document.querySelector('.md-fab')!.getBoundingClientRect();
    return Math.abs(fab.top + fab.height / 2 - (nav.top + nav.height / 2));
  });

  expect(offset).toBeLessThanOrEqual(40);
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

  await page.getByLabel('Profil').click();
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
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toBeVisible();
  await expect(page.getByText('Deine Lauftechnik')).toBeHidden();

  // Mit Einlagen: dieselben GPS-Werte, zusaetzlich die Technikdaten.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?mode=insole'));
  await expect(page.getByText('Mit Sensoreinlagen aufgezeichnet')).toBeVisible();
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toBeHidden();
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

  const geometry = await page.evaluate(() => {
    const row = document.querySelector('.md-chat-input-row')!.getBoundingClientRect();
    const send = document.querySelector('.md-chat-send')!.getBoundingClientRect();
    const log = document.querySelector('.md-chat-log')!;
    return {
      rowBottom: row.bottom,
      sendRight: send.right,
      width: window.innerWidth,
      height: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      logScrolls: log.scrollHeight > log.clientHeight,
    };
  });

  // Die Eingabezeile steht am unteren Rand, nicht darunter.
  expect(Math.abs(geometry.rowBottom - geometry.height)).toBeLessThanOrEqual(4);
  // Kein Teil der Zeile wird vom Rahmen abgeschnitten.
  expect(geometry.sendRight).toBeLessThanOrEqual(geometry.width);
  // Die Seite selbst scrollt nicht, die Nachrichtenliste schon.
  expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.height + 4);
  expect(geometry.logScrolls).toBe(true);
});


test('renders the designed dark theme instead of an inverted page', async ({ page }) => {
  // Auf einem Telefon mit dunkler Systemeinstellung greift das gestaltete
  // dunkle Thema aus tokens.css. Die Marken-Navy-Flaeche wird dort bewusst
  // hell – das ist Absicht und keine algorithmische Umkehrung.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  const dark = await page.evaluate(
    () => getComputedStyle(document.querySelector('.md-fab')!).backgroundColor,
  );

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  const light = await page.evaluate(
    () => getComputedStyle(document.querySelector('.md-fab')!).backgroundColor,
  );

  expect(light).toBe('rgb(22, 33, 62)');
  expect(dark).toBe('rgb(255, 255, 255)');
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


test('drops the insole promo when looking back at an old run', async ({ page }) => {
  await page.goto(mockupUrl('lauf-zusammenfassung.html?from=tracking'));
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toBeVisible();

  await page.goto(mockupUrl('lauf-zusammenfassung.html'));
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toBeHidden();
  // Die Werte des Laufs bleiben, nur die Angebote verschwinden.
  await expect(page.getByText('8,2 km', { exact: true })).toBeVisible();
  await expect(page.getByText('Kilometer-Abschnitte')).toBeVisible();

  // Mit Einlagen bleibt der Technikblock auch beim Nachschauen sichtbar –
  // das sind Messwerte, kein Angebot.
  await page.goto(mockupUrl('lauf-zusammenfassung.html?mode=insole'));
  await expect(page.getByText('Deine Lauftechnik')).toBeVisible();
  await expect(page.getByText('Technikdaten benötigen Sensoreinlagen')).toBeHidden();
});


test('opens the side menu for self-made plans from the exercise tab', async ({ page }) => {
  // Telefonbreite: nur dort fuellt der Rahmen den Bildschirm, sodass ein Tipp
  // neben das Menue auch wirklich den Scrim trifft.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(mockupUrl('uebungen.html'));

  const drawer = page.locator('.md-drawer');
  await expect(drawer).toBeHidden();

  await page.getByRole('link', { name: 'Weitere Optionen' }).click();
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gym-Trainingsplan erstellen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trainingstagebuch' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lauftraining selbst erstellen' })).toBeVisible();

  // Schliessen ueber das Symbol im Kopf des Menues.
  await page.getByRole('link', { name: 'Menü schließen' }).nth(1).click();
  await expect(drawer).toBeHidden();

  // Und durch Tippen neben das Menue.
  await page.getByRole('link', { name: 'Weitere Optionen' }).click();
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
