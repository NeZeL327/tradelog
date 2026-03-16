# Logowanie Google i Apple – konfiguracja krok po kroku

Aplikacja ma już w kodzie przyciski „Google” i „Apple” na stronie logowania. Żeby działały, musisz włączyć te metody w Firebase i (dla Apple) skonfigurować Apple Developer.

---

## Część 1: Logowanie przez Google

### Krok 1.1 – Wejście do Firebase Console
1. Otwórz przeglądarkę i wejdź na: **https://console.firebase.google.com**
2. Zaloguj się na konto Google (to samo, na którym masz projekt).
3. Wybierz **swoj projekt** (ten, którego `projectId` jest w `.env` jako `VITE_FIREBASE_PROJECT_ID`).

### Krok 1.2 – Włączenie metody Google
1. W lewym menu kliknij **„Authentication”** („Uwierzytelnianie”).
2. Przejdź do zakładki **„Sign-in method”** / **„Metoda logowania”**.
3. Na liście dostawców znajdź **„Google”** i kliknij wiersz (lub ikonę ołówka).
4. Przełącz **„Enable”** / **„Włącz”** na **ON**.
5. W polu **„Project support email”** wybierz swój email (np. kontakt@twojadomena.pl).
6. Kliknij **„Save”** / **„Zapisz”**.

### Krok 1.3 – Sprawdzenie w aplikacji
1. Uruchom aplikację (`npm run dev`).
2. Wejdź na stronę logowania (np. `/login`).
3. Kliknij przycisk **„Google”**.
4. Aplikacja używa **przekierowania** (cała strona przechodzi do Google) – nie ma okna popup. Po wyborze konta Google użytkownik wraca na stronę i jest przekierowany do Dashboardu.

---

## Część 2: Logowanie przez Apple

Logowanie Apple wymaga konta **Apple Developer** (płatne, ok. 99 USD/rok) oraz kilku kroków w Apple i w Firebase.

### Krok 2.1 – Apple Developer
1. Wejdź na **https://developer.apple.com** i zaloguj się.
2. Jeśli nie masz konta – **Account** → **Join the Apple Developer Program** i dokończ rejestrację (wymagana płatność).

### Krok 2.2 – Utworzenie identyfikatora usługi (Services ID)
1. W **Apple Developer** przejdź do: **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Kliknij **„+”** (Add).
3. Wybierz **„Services IDs”** → **Continue**.
4. Wypełnij:
   - **Description:** np. `AiKeepTrade Web Login`
   - **Identifier:** np. `pl.aikeeptrade.signin` (musi być unikalny, często odwrócona domena).
5. Zaznacz **„Sign In with Apple”** → **Configure**.
6. W konfiguracji:
   - **Primary App ID:** wybierz swój App ID (jeśli nie masz, wcześniej utwórz **App ID** w Identifiers).
   - **Domains and Subdomains:**  
     - Na development: możesz wpisać `localhost` (Apple czasem wymaga też domeny).  
     - Na produkcję: np. `twojadomena.pl` i ewentualnie `www.twojadomena.pl`.
   - **Return URLs:**  
     - Development: `https://twoj-projekt.firebaseapp.com/__/auth/handler`  
       (znajdziesz dokładny URL w Firebase: Authentication → Sign-in method → Apple → **Web configuration** → „Callback URL”).  
     - Produkcja: ten sam format, z Twoją domeną, np. `https://twojadomena.pl/__/auth/handler` (Firebase podpowie dokładny adres).
7. **Save** → **Continue** → **Register**.

### Krok 2.3 – Klucz (Key) dla Sign in with Apple
1. W **Certificates, Identifiers & Profiles** → **Keys** → **„+”**.
2. **Key Name:** np. `AiKeepTrade Apple Sign In`.
3. Zaznacz **„Sign In with Apple”** → **Configure** → wybierz swój **Primary App ID** (ten sam co przy Services ID).
4. **Register** → **Download** klucza (`.p8`) – **pobierz tylko raz**, Apple nie pozwoli pobrać ponownie.
5. Zapisz **Key ID** oraz **Team ID** i **Services ID** – będą potrzebne w Firebase.

### Krok 2.4 – Włączenie Apple w Firebase
1. W **Firebase Console** → **Authentication** → **Sign-in method**.
2. Kliknij **„Apple”** (wiersz na liście).
3. Przełącz **Enable** na **ON**.
4. W sekcji **Web configuration** / **Web SDK configuration** wypełnij:
   - **Services ID:** ten z Kroku 2.2 (np. `pl.aikeeptrade.signin`).
   - **Apple Team ID:** z Apple Developer (Account → Membership).
   - **Key ID:** z Kroku 2.3.
   - **Private Key:** wklej **całą** zawartość pobranego pliku `.p8` (włącznie z `-----BEGIN PRIVATE KEY-----` i `-----END PRIVATE KEY-----`).
5. **Save**.

### Krok 2.5 – Sprawdzenie w aplikacji
1. Uruchom aplikację i wejdź na `/login`.
2. Kliknij przycisk **„Apple”**.
3. Powinno otworzyć się okno Apple (lub przekierowanie); po zalogowaniu użytkownik wraca do aplikacji i jest zalogowany.

Aplikacja używa przekierowania (redirect) także dla Apple – cała strona przechodzi do Apple, po zalogowaniu użytkownik wraca do aplikacji.

---

## Szybka checklista

**Google**
- [ ] Firebase Console → Authentication → Sign-in method → Google → **Włącz**
- [ ] Ustawiony Project support email
- [ ] Test na stronie /login – przycisk „Google”

**Apple**
- [ ] Konto Apple Developer (płatne)
- [ ] Utworzony Services ID z Sign In with Apple (domains + return URLs)
- [ ] Utworzony Key (.p8) i zapisany Key ID
- [ ] Firebase → Apple → włączone + wypełnione Services ID, Team ID, Key ID, Private Key
- [ ] Test na stronie /login – przycisk „Apple”

---

## Gdy coś nie działa

- **Google/Apple: „Redirect domain not authorized” / nieautoryzowana domena** – w Firebase: **Authentication → Settings → Authorized domains** dodaj domenę (np. `localhost` dla dev).
- **Apple: błąd konfiguracji** – sprawdź dokładnie Return URL (musi być identyczny z tym z Firebase, łącznie z `/__/auth/handler`).
- Logowanie działa przez **przekierowanie** (cała karta idzie do Google/Apple), więc nie ma problemu z blokowaniem popupów.

Po wykonaniu tych kroków logowanie Google i Apple w Twojej aplikacji będzie działać zgodnie z kodem, który już masz w projekcie.
