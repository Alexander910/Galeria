param([string]$ResourceGroup = 'nogal-project', [string]$ImageTag)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$az = Join-Path $PSScriptRoot 'az.ps1'
function Invoke-AzureJson {
  param([string[]]$Arguments)
  $result = & $az @Arguments --only-show-errors --output json
  if ($LASTEXITCODE -ne 0) { throw 'La operación de Azure no se completó.' }
  return ($result | ConvertFrom-Json)
}
$foundation = Invoke-AzureJson -Arguments @('deployment','group','show','--resource-group',$ResourceGroup,'--name','nogal-foundation','--query','properties.outputs')
$group = Invoke-AzureJson -Arguments @('group','show','--name',$ResourceGroup)
$users = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'data\users.json') | ConvertFrom-Json).users
if ($users.Count -ne 3 -or (($users.username | Sort-Object) -join ',') -ne 'Astid,Elvia,Zulema') { throw 'Se requieren exactamente los tres usuarios autorizados.' }
$source = Join-Path $projectRoot 'tmp\deploy-source'
New-Item -ItemType Directory -Path $source -Force | Out-Null
foreach ($file in @('Dockerfile','package.json','package-lock.json','server.js','gallery-store.js','azure-store.js','index.html','login.html','usuarios.html','api.js','login.js','usuarios.js','style.css','gallery.css')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $source $file) -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets') -Destination $source -Recurse -Force
$tag = $ImageTag
if (!$tag) {
  $tag = 'nogal:' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
  Write-Output 'Construyendo la aplicación en Azure Container Registry...'
  & $az acr build --registry $foundation.registryName.value --image $tag --platform linux/amd64 $source --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir la imagen. Para cuentas sin ACR Tasks, prepara la imagen con Crane y usa -ImageTag.' }
}
$visionKey = & $az cognitiveservices account keys list --resource-group $ResourceGroup --name $foundation.visionName.value --query key1 --output tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or !$visionKey) { throw 'No se pudo configurar el análisis de imágenes.' }
$parameters = @{
  location = @{value=$group.location}
  environmentId = @{value=$foundation.environmentId.value}
  identityId = @{value=$foundation.identityId.value}
  identityClientId = @{value=$foundation.identityClientId.value}
  registryServer = @{value=$foundation.registryServer.value}
  image = @{value=($foundation.registryServer.value + '/' + $tag)}
  publicOrigin = @{value=('https://nogal.' + $foundation.defaultDomain.value)}
  tableEndpoint = @{value=$foundation.tableEndpoint.value}
  blobEndpoint = @{value=$foundation.blobEndpoint.value}
  visionEndpoint = @{value=$foundation.visionEndpoint.value}
  visionKey = @{value=$visionKey.Trim()}
  bootstrapUsers = @{value=ConvertTo-Json -InputObject @($users) -Depth 10 -Compress}
}
$parametersFile = Join-Path $projectRoot 'data\azure-app.parameters.json'
@{parameters=$parameters} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $parametersFile -Encoding utf8
Write-Output 'Desplegando la aplicación con HTTPS y secretos protegidos...'
try {
  $deployment = Invoke-AzureJson -Arguments @('deployment','group','create','--resource-group',$ResourceGroup,'--name','nogal-app','--template-file',(Join-Path $PSScriptRoot 'app.bicep'),'--parameters',('@'+$parametersFile))
  $deployment.properties.outputs.url.value
} finally {
  if (Test-Path -LiteralPath $parametersFile) { Remove-Item -LiteralPath $parametersFile -Force }
}
