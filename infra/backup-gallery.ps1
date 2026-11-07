param([string]$BaseUrl = 'https://nogal.kindpebble-24b4b111.canadacentral.azurecontainerapps.io')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $projectRoot 'data\backups'
$directory = Join-Path $backupRoot ((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path (Join-Path $directory 'images') -Force | Out-Null
$gallery = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/api/artworks')
$gallery.works | ConvertTo-Json -Depth 20 -AsArray | Set-Content -LiteralPath (Join-Path $directory 'gallery.json') -Encoding utf8
$users = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'data\users.json') | ConvertFrom-Json).users
foreach ($user in $users) { $user.id = $user.username.ToLowerInvariant() }
@{ users = $users } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory 'users.json') -Encoding utf8
$files = @()
foreach ($work in $gallery.works) {
  if ($work.imageUrl -notmatch '^/media/([a-f0-9-]{36}\.(png|jpeg|webp))$') { throw 'Referencia de imagen inesperada; se canceló el respaldo.' }
  $filename = $Matches[1]
  $destination = Join-Path (Join-Path $directory 'images') $filename
  Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + $work.imageUrl) -OutFile $destination
  $files += @{ name = $filename; sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash }
}
@{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); source = $BaseUrl; images = $files; includesSessions = $false } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory 'manifest.json') -Encoding utf8
Compress-Archive -Path (Join-Path $directory '*') -DestinationPath ($directory + '.zip')
Write-Output "Respaldo creado: $($directory).zip"
Write-Output "Imágenes: $($files.Count). Incluye metadatos y hashes de los tres usuarios; no incluye sesiones."
