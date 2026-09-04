# Odtwarzanie AIKeepTrade po utracie komputera

## Co gdzie jest

- **Kod aplikacji** — GitHub: https://github.com/NeZeL327/tradelog.git
- **Dane użytkowników, transakcje, notatki** — Firebase projekt `trade-log-b814b` (Firestore + Storage + Authentication). Tego nie ma w GitHubie.
- **Klucze lokalne** (`.env` i `functions/.env`) — nie są w GitHubie. Trzymaj kopię w bezpiecznym miejscu (np. zip na dysku / chmurze prywatnej).

## 1. Kod

```
git clone https://github.com/NeZeL327/tradelog.git
cd tradelog
npm install
cd functions
npm install
cd ..
```

## 2. Pliki .env

Skopiuj szablony i uzupełnij wartości:

```
copy .env.example .env
copy functions\.env.example functions\.env
```

Klucze Firebase: Console → Project settings → Your apps.  
Stripe: Dashboard Stripe (klucz publiczny do `.env`, sekret do `functions/.env`).

## 3. Firebase

```
firebase login
firebase use trade-log-b814b
npm run build
firebase deploy --only hosting
```

## 4. Konta

Użytkowników dodajesz tylko w Firebase Authentication (e-mail + hasło). Rejestracja w aplikacji jest wyłączona.
