# Deploy bez firebase login — wymaga pliku firebase-key.json (klucz z Firebase Console)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$keyPath = Join-Path $root "firebase-key.json"
if (-not (Test-Path $keyPath)) {
    Write-Host "Brak firebase-key.json" -ForegroundColor Red
    Write-Host "Firebase Console -> Ustawienia -> Konta uslugowe -> Generuj nowy klucz prywatny"
    Write-Host "Zapisz plik jako: $keyPath"
    exit 1
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $keyPath
npm run build
firebase deploy --only "hosting,storage" --project trade-log-b814b
Write-Host "Gotowe: https://trade-log-b814b.web.app" -ForegroundColor Green
