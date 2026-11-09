param([string]$BaseUrl = 'https://nogal-uietolmehuftu-1.northcentralus.cloudapp.azure.com')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $projectRoot 'data\backups'
$directory = Join-Path $backupRoot ((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path (Join-Path $directory 'images') -Force | Out-Null
$gallery = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/api/artworks')
$gallery.works | ConvertTo-Json -Depth 20 -AsArray | Set-Content -LiteralPath (Join-Path $directory 'gallery.json') -Encoding utf8
$users = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'data\users.json') | ConvertFrom-Json).users
$profiles = (Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/api/profiles')).profiles
$unknownProfiles=@($profiles|Where-Object { $_.id -notin @($users|ForEach-Object {$_.username.Trim().Normalize([Text.NormalizationForm]::FormKC).ToLowerInvariant()}) })
if($unknownProfiles.Count){throw 'Hay cuentas creadas en Azure sin hashes locales. Usa el respaldo completo de nogal-ops y descarga su tar.gz privado; no se generará una copia incompleta.'}
foreach ($user in $users) {
  $user.id = $user.username.Trim().Normalize([Text.NormalizationForm]::FormKC).ToLowerInvariant()
  $current = $profiles | Where-Object { $_.id -eq $user.id } | Select-Object -First 1
  if (-not $current) { throw 'No se encontró un perfil autorizado; se canceló el respaldo.' }
  foreach ($field in @('name','bio','location','specialty','photoUrl','contactEmail','contactPhone','website')) {
    if ($current.PSObject.Properties.Name -contains $field) { $user | Add-Member -NotePropertyName $field -NotePropertyValue $current.$field -Force }
  }
}
@{ users = $users } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory 'users.json') -Encoding utf8
$files = @()
$imageUrls = @($gallery.works | ForEach-Object { $_.imageUrl }) + @($users | Where-Object { $_.photoUrl } | ForEach-Object { $_.photoUrl })
foreach ($imageUrl in ($imageUrls | Sort-Object -Unique)) {
  if ($imageUrl -notmatch '^/media/([a-f0-9-]{36}\.(png|jpeg|webp))$') { throw 'Referencia de imagen inesperada; se canceló el respaldo.' }
  $filename = $Matches[1]
  $destination = Join-Path (Join-Path $directory 'images') $filename
  Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + $imageUrl) -OutFile $destination
  $files += @{ name = $filename; sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash }
}
@{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); source = $BaseUrl; images = $files; includesSessions = $false } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory 'manifest.json') -Encoding utf8
Compress-Archive -Path (Join-Path $directory '*') -DestinationPath ($directory + '.zip')
Write-Output "Respaldo creado: $($directory).zip"
Write-Output "Imágenes: $($files.Count). Incluye metadatos y hashes de $($users.Count) usuarios; no incluye sesiones."
