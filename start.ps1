# EXILE HUB — включить МОДУЛЬ 3 (локальный бэкенд: сайт + админка + Telegram).
# Запуск: двойной клик по файлу (ПКМ → "Выполнить с помощью PowerShell") или в терминале:  .\start.ps1
# Остановить: Ctrl+C в этом окне (или просто закрыть окно).

Set-Location $PSScriptRoot
Write-Host ""
Write-Host "  Модуль 3 запускается..." -ForegroundColor Green
Write-Host "  Сайт:    http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Админка: http://localhost:8000/admin" -ForegroundColor Cyan
Write-Host "  (не закрывай это окно, пока пользуешься; Ctrl+C — остановить)" -ForegroundColor DarkGray
Write-Host ""
.\.venv\Scripts\python -m uvicorn backend.app:app --port 8000
