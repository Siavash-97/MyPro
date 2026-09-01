# E-Mail-Bestätigung

Wie ein neu angelegtes Konto freigeschaltet wird – und was dafür im
Supabase-Projekt eingestellt sein muss.

## Zwei Wege, ein Ziel

Die Bestätigungsmail enthält beides: einen **sechsstelligen Code** und einen
**Link**. Beide lösen denselben einmaligen Token ein – wer den einen benutzt,
verbraucht damit den anderen.

**Code** (der übliche Weg). Man tippt ihn direkt nach der Registrierung ein,
auf dem Schritt „Fast geschafft“. Der Weg bleibt vollständig in der App; das
ist der Grund, warum es ihn gibt. In der Android-Hülle führt ein Link in den
Browser des Telefons, und der Rückweg von dort bräuchte einen Tiefenverweis.

**Link** (der Ersatzweg). Er führt auf `/bestaetigen` in der Web-App. Nötig
wird er, wenn der Tab mit der Registrierung nicht mehr offen ist oder jemand
die Mail auf einem anderen Gerät liest. Dieselbe Seite bietet auch die
Code-Eingabe an, samt E-Mail-Feld – falsch geht dort also nichts verloren.

Nach dem Bestätigen steht die Sitzung. Es geht weiter auf `/profil/setup`, und
von dort auf die Startseite, falls schon ein Profil existiert. Kein zweiter
Anmeldevorgang.

## Wo das im Code steht

| Datei | Aufgabe |
| --- | --- |
| [`src/lib/authRedirect.ts`](../myprosole_web/src/lib/authRedirect.ts) | Baut die Adresse für `emailRedirectTo` |
| [`src/lib/pendingSignup.ts`](../myprosole_web/src/lib/pendingSignup.ts) | Merkt die Adresse, deren Bestätigung aussteht |
| [`src/components/auth/CodeConfirmForm.tsx`](../myprosole_web/src/components/auth/CodeConfirmForm.tsx) | Das Code-Formular, geteilt von beiden Seiten |
| [`src/pages/ConfirmEmail.tsx`](../myprosole_web/src/pages/ConfirmEmail.tsx) | Die Route `/bestaetigen` |
| [`src/store/auth.ts`](../myprosole_web/src/store/auth.ts) | `signUp`, `verifyCode`, `resendCode` |

### Warum die Zieladresse nicht einfach `window.location.origin` ist

Im Browser ist sie genau das: Wer sich lokal registriert, wird lokal bestätigt,
wer auf der Produktionsauslieferung registriert, dort.

In der Android-Hülle läuft die App unter `https://localhost`. Diese Adresse
gibt es im Browser des Telefons nicht, und in der Redirect-Liste des
Supabase-Projekts steht sie auch nicht – ein Link dorthin führt ins Leere.
Deshalb gilt dort `VITE_PUBLIC_SITE_URL` aus
[`.env.production`](../myprosole_web/.env.production).

## Einstellungen im Supabase-Projekt

Projekt **MyProSole-App** (`pssyomphfjvhnnuljtzh`), unter
*Authentication → URL Configuration*:

- **Redirect URLs**: `https://my-pro-n38r.vercel.app/**` deckt `/bestaetigen`
  bereits ab. Für die lokale Entwicklung muss `http://localhost:5173/**` in der
  Liste stehen, sonst fällt Supabase auf die Site URL zurück.
- **Site URL**: **muss** auf `https://my-pro-n38r.vercel.app` zeigen. Sie
  greift nur noch, wenn eine Mail ohne eigene Zieladresse verschickt wird –
  E-Mail-Wechsel, Einladung, Magic Link – und für jeden Bau ohne
  `.env.production`.

  **Warum aus „sollte" ein „muss" wurde (25.08.2026):** Sie zeigte auf
  `…/design/mockups/confirm-email.html`. Diese Seite entstand nur, weil ein
  Plugin in `myprosole_web/vite.config.ts` den Entwurfsordner in den Build
  kopierte. Das Plugin ist entfernt – der Entwurfsordner gehört nicht in die
  ausgelieferte App. Damit gibt es die Seite dort nicht mehr, und
  `vercel.json` nahm `/design/` ausdrücklich vom SPA-Rückfall aus: Die
  Adresse hätte einen **harten 404** geliefert, nicht einmal die Startseite.
  Die toten `/design/`-Regeln sind mit entfernt.

**Veraltet, hier zur Warnung stehengelassen:** An dieser Stelle stand, das
Zurücksetzen des Passworts (`resetPassword` in `src/store/auth.ts`) gebe
keine eigene Zieladresse mit und folge deshalb der Site URL. **Das stimmt
nicht mehr** – `auth.ts` übergibt `redirectTo: passwortNeuUrl()`, und der
Kommentar darüber begründet es. Nachgelesen am 25.08.2026, nachdem ein
Prüfagent die veraltete Stelle als Tatsache weitergegeben hatte. Nach der Umstellung
landet dieser Link auf der Startseite der App – der Nutzer ist dann zwar
angemeldet, bekommt aber kein Feld zum Setzen eines neuen Passworts. Das ist
nicht schlimmer als heute (heute landet er auf einer Entwurfsseite, die für
diesen Fall gar nichts tut), muss aber nachgezogen werden: eigene Route zum
Neusetzen des Passworts plus `redirectTo` bei `resetPasswordForEmail`.

## Tiefenverweis für die Android-Hülle: geprüft, derzeit nicht nötig

Ein echter Android-App-Link – der Link aus der Mail öffnet direkt die App statt
des Browsers – bräuchte drei Dinge:

1. einen `intent-filter` mit `android:autoVerify="true"` in
   [`AndroidManifest.xml`](../myprosole_web/android/app/src/main/AndroidManifest.xml),
2. eine `/.well-known/assetlinks.json` auf der Domain, mit dem
   SHA-256-Fingerabdruck des Signaturschlüssels der App,
3. einen Signaturschlüssel, der sich nicht mehr ändert.

Punkt 3 fehlt: `android/app/build.gradle` hat keine `signingConfig` für
`release`, gebaut wird mit dem Debug-Schlüssel. Dessen Fingerabdruck ist an den
Rechner gebunden – eine `assetlinks.json` darauf wäre auf jedem anderen Rechner
falsch, und Google Play signiert später ohnehin mit einem eigenen Schlüssel.

Gebraucht wird der Tiefenverweis auch nicht: In der Hülle ist der Code der
vorgesehene Weg, und der verlässt die App nie. Wer den Link trotzdem antippt,
wird im Browser bestätigt und findet in der App zwei Ausgänge – „Code erneut
senden“ für einen frischen, in der App gültigen Code, und „Schon über den Link
bestätigt? Anmelden“.

**Folgeaufgabe:** Sobald die App für Google Play signiert wird, den App-Link
nachrüsten. Erst dann ist der Fingerabdruck stabil genug, dass sich die
`assetlinks.json` lohnt.
