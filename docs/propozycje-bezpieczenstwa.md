# Propozycje zmian bezpieczeństwa (do decyzji Pawła)

Ten dokument **niczego nie zmienia**. Pliki `firestore.rules`, `storage.rules` i `functions/` są takie jak wcześniej. Każdą zmianę trzeba wdrożyć ręcznie (patrz README → Wdrożenie).

## 1. Firestore: klient nie może sam nadać sobie planu

**Stan obecny.** `match /subscriptions/{userId}` pozwala zalogowanemu użytkownikowi na `read, write` własnego dokumentu. Aplikacja tylko go **czyta** (`src/hooks/use-subscription.js`, `onSnapshot`). Zapisuje go wyłącznie Cloud Function `stripeWebhook` (`functions/index.js`) przez Admin SDK, który omija reguły.

**Ryzyko.** Ktoś może z konsoli przeglądarki wykonać `setDoc(doc(db, "subscriptions", uid), { status: "active", plan: "pro" })`, a `isPremium` od razu zwróci `true`.

**Propozycja:**

```diff
     match /subscriptions/{userId} {
-      allow read, write: if request.auth != null && request.auth.uid == userId;
+      allow read: if request.auth != null && request.auth.uid == userId;
+      // Zapis tylko z Cloud Functions (Admin SDK omija reguły).
+      allow write: if false;
     }
```

Wpływ na aplikację: żaden, bo klient nigdzie nie zapisuje do `/subscriptions`. Wdrożenie: `firebase deploy --only firestore:rules --project trade-log-b814b`.

## 2. Storage: limit rozmiaru i tylko obrazy

**Co aplikacja naprawdę wysyła:**

| Ścieżka | Skąd | Typ po konwersji |
| --- | --- | --- |
| `users/{uid}/trade-screenshots/…` | `uploadTradeScreenshot` (zrzuty transakcji) | JPEG / PNG / WebP / GIF / AVIF; HEIC → JPEG, TIFF → PNG, BMP → JPEG |
| `users/{uid}/report-screenshots/…` | `uploadUserFile` (moduł Raporty, obecnie nieużywany) | jw. |
| `tradeScreenshots/{uid}/…` | stara ścieżka, w kodzie już nie zapisywana | — |

Przed wysłaniem plik jest kompresowany (`compressImage`: maks. 0,6 MB, 1920 px), a `prepareImageFile` odrzuca pliki powyżej 25 MB. Gdy kompresja się nie uda, idzie oryginał, więc limit 10 MB zostawia zapas.

**Uwaga:** reguła `write` obejmuje też usuwanie, a przy usuwaniu `request.resource` jest `null`. Dlatego `delete` musi być osobną regułą.

**Propozycja:**

```diff
 rules_version = '2';
 service firebase.storage {
   match /b/{bucket}/o {
+    function isOwner(userId) {
+      return request.auth != null && request.auth.uid == userId;
+    }
+    function isSmallImage() {
+      return request.resource.size < 10 * 1024 * 1024
+        && request.resource.contentType.matches('image/.*');
+    }
     match /users/{userId}/{allPaths=**} {
-      allow read, write: if request.auth != null && request.auth.uid == userId;
+      allow read, delete: if isOwner(userId);
+      allow create, update: if isOwner(userId) && isSmallImage();
     }
     match /tradeScreenshots/{userId}/{allPaths=**} {
-      allow read, write: if request.auth != null && request.auth.uid == userId;
+      allow read, delete: if isOwner(userId);
+      allow create, update: if isOwner(userId) && isSmallImage();
     }
   }
 }
```

Do sprawdzenia przed wdrożeniem: czy nic poza obrazami nie trafia do `users/{uid}/…` (w kodzie nie znalazłem innych typów). Stara strona Notes zapisuje do `notes-images/{uid}/…`, ale na tę ścieżkę nie ma żadnej reguły, więc już teraz takie zapisy są odrzucane. Strona Notes nie jest podpięta w routingu.

Uwaga: CI wdraża reguły Storage automatycznie (krok „Deploy storage rules”), więc po zmianie pliku trafią na produkcję przy najbliższym pushu na `main`.

## 3. Cloud Functions: Stripe bez sprawdzenia, kto pyta (ważne)

`createCheckoutSession` i `createPortalSession` biorą `userId` z treści żądania i **nie sprawdzają tokenu Firebase**. CORS odbija każdy `Origin`. Skutek: kto zna czyjś `uid`, może wygenerować link do **portalu Stripe tej osoby** (podgląd faktur, anulowanie subskrypcji). `returnUrl` też nie jest sprawdzany (otwarte przekierowanie).

**Propozycja** (wymaga zmiany functions i `src/lib/billing.js`, potem `firebase deploy --only functions`):

1. Klient wysyła `Authorization: Bearer <await auth.currentUser.getIdToken()>`.
2. Funkcja robi `const { uid } = await admin.auth().verifyIdToken(token)` i używa `uid` zamiast `req.body.userId`.
3. `returnUrl`, `successUrl` i `cancelUrl` są przyjmowane tylko z domen `https://trade-log-b814b.web.app` i `https://trade-log-b814b.firebaseapp.com` (oraz `http://127.0.0.1:3000` w dev).
4. `Access-Control-Allow-Origin` tylko dla tych domen.

## 4. Content-Security-Policy (nie dodana)

Nagłówki `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` i `Cache-Control` są już w `firebase.json` (sprawdzone na emulatorze hostingu). CSP celowo **nie** została dodana, bo bez testów na produkcji łatwo coś zepsuć:

- Firebase Auth (Google/Apple) używa popupów i iframe z `*.firebaseapp.com` / `accounts.google.com` / `appleid.apple.com`,
- Firestore łączy się przez `firestore.googleapis.com` (długie połączenia), Storage przez `firebasestorage.googleapis.com`,
- Analytics (`measurementId`) ładuje `googletagmanager.com`,
- przekierowanie do Stripe Checkout, wykresy świecowe pobierają dane z Yahoo (`/yahoo-chart` proxy działa tylko w dev),
- Tailwind/Radix i Recharts wstawiają style inline (potrzebne `style-src 'unsafe-inline'`),
- zdjęcia są wyświetlane jako `blob:` i `data:`.

Rekomendacja: najpierw `Content-Security-Policy-Report-Only` na tydzień, zebrać naruszenia z konsoli, dopiero potem włączyć.
