# Один раз кладёт публичный ключ деплоя на Beget. ssh спросит пароль FTP/SSH-аккаунта — вводит владелец.
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\install-ssh-key.ps1
$pub = Join-Path $env:USERPROFILE '.ssh\beget_ed25519.pub'
if (-not (Test-Path $pub)) { Write-Error "Нет ключа $pub"; exit 1 }
$target = 'yourkedm_rambajo@yourkedm.beget.tech'
Get-Content $pub | ssh -o StrictHostKeyChecking=accept-new $target "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo KEY-INSTALLED && pwd"
