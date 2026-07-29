# EXILE HUB — опубликовать текущий контент на GitHub Pages.
#   1) пересобирает web/data/feed.json из локальной БД (учитывает скрытые/закреплённые)
#   2) коммитит и пушит -> GitHub Action задеплоит сайт за ~1 минуту.
# Запуск:  .\deploy.ps1

.\.venv\Scripts\python -c "import sys; sys.path.insert(0,'pipeline'); import db; db.init_db(); print('feed:', db.export_feed('web/data/feed.json',80), '| articles:', db.export_articles('web/data/articles.json'), '| creators:', db.export_creators('web/data/creators.json'))"
.\.venv\Scripts\python pipeline\poeninja.py

git add -A
git commit -m ("content update " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
if ($LASTEXITCODE -ne 0) { Write-Host "Нет изменений для коммита — публиковать нечего."; exit 0 }
git push
Write-Host "Готово. Сайт обновится на GitHub Pages через ~1 минуту."
