param(
  [string]$BackupPath = 'data/backups/20261107-034140.zip',
  [string]$ResourceGroup = 'nogal-final',
  [string]$StorageAccount = 'nogaluietolmehuftu',
  [string]$PythonExecutable = 'C:/Users/usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
  [switch]$Apply
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $projectRoot
function Invoke-NogalAz {
  $result=& (Join-Path $projectRoot 'infra/az.ps1') @args
  if($LASTEXITCODE -ne 0){throw 'Falló una operación de Azure; revisar el error anterior.'}
  return $result
}
& $PythonExecutable infra/vm/prepare-local-restore.py $BackupPath
if($LASTEXITCODE -ne 0){throw 'Respaldo inválido.'}
$storageId=(Invoke-NogalAz storage account show -g $ResourceGroup -n $StorageAccount --query id -o tsv --only-show-errors).Trim()
$scope=$storageId+'/blobServices/default/containers/backups'
$operatorId=(Invoke-NogalAz ad signed-in-user show --query id -o tsv --only-show-errors).Trim()
$appId=(Invoke-NogalAz identity show -g $ResourceGroup -n nogal-app-identity --query principalId -o tsv --only-show-errors).Trim()
$temporaryRoles=@()
try {
  $temporaryRoles+=((Invoke-NogalAz role assignment create --name ([guid]::NewGuid().ToString()) --assignee-object-id $operatorId --assignee-principal-type User --role 'Storage Blob Data Contributor' --scope $scope --query id -o tsv --only-show-errors).Trim())
  $temporaryRoles+=((Invoke-NogalAz role assignment create --name ([guid]::NewGuid().ToString()) --assignee-object-id $appId --assignee-principal-type ServicePrincipal --role 'Storage Blob Data Reader' --scope $scope --query id -o tsv --only-show-errors).Trim())
  $blob='reactivacion-'+[DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.tar.gz'
  $uploaded=$false
  for($attempt=0;$attempt -lt 8;$attempt++){
    & (Join-Path $projectRoot 'infra/az.ps1') storage blob upload --account-name $StorageAccount --container-name backups --name $blob --file data/deploy/local-restore.tar.gz --auth-mode login --overwrite true --query '{name:name}' -o json --only-show-errors
    if($LASTEXITCODE -eq 0){$uploaded=$true;break}
    Start-Sleep -Seconds 15
  }
  if(-not $uploaded){throw 'No se pudo transferir el respaldo privado.'}
  $restoreCode=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $projectRoot 'infra/vm/restore.cjs')))
  $script=@'
#!/bin/bash
set -euo pipefail
install -d -o 1000 -g 1000 -m 700 /var/lib/nogal-restore
printf %s __CODE__ | base64 -d > /opt/nogal/restore.cjs
chmod 644 /opt/nogal/restore.cjs
docker run --rm --env-file /etc/nogal/app.env -v /var/lib/nogal-restore:/restore nogal:project node -e "const {BlobServiceClient}=require('@azure/storage-blob');const {DefaultAzureCredential}=require('@azure/identity');const run=async()=>{const b=new BlobServiceClient(process.env.BLOB_ENDPOINT,new DefaultAzureCredential()).getContainerClient('backups').getBlockBlobClient('__BLOB__');for(let i=0;i<8;i++){try{await b.downloadToFile('/restore/archive.tar.gz');return}catch(e){if(i===7)throw e;await new Promise(r=>setTimeout(r,15000))}}};run().catch(e=>{console.error(e.message);process.exitCode=1})"
docker run --rm -v /var/lib/nogal-restore:/restore nogal:project tar -xzf /restore/archive.tar.gz -C /restore
docker run --rm --env-file /etc/nogal/app.env -v /var/lib/nogal-restore:/restore:ro -v /opt/nogal/restore.cjs:/app/restore.cjs:ro nogal:project node restore.cjs /restore
docker run --rm --env-file /etc/nogal/app.env -v /var/lib/nogal-restore:/restore:ro -v /opt/nogal/restore.cjs:/app/restore.cjs:ro nogal:project node restore.cjs /restore __APPLY__
echo NOGAL_RESTORE_OK
'@
  $script=$script.Replace('__CODE__',$restoreCode).Replace('__BLOB__',$blob).Replace('__APPLY__',$(if($Apply){'--apply'}else{''})).Replace("`r",'')
  $scriptPath=Join-Path $projectRoot 'data/deploy/restore-current.sh'
  [IO.File]::WriteAllText($scriptPath,$script,[Text.UTF8Encoding]::new($false))
  $messages=Invoke-NogalAz vm run-command invoke -g $ResourceGroup -n nogal-app-1 --command-id RunShellScript --scripts ('@'+$scriptPath) --query 'value[].message' -o tsv --only-show-errors
  $messages | Write-Output
  if(($messages -join "`n") -notmatch 'NOGAL_RESTORE_OK'){throw 'La VM no confirmó la recuperación.'}
  @{at=[DateTimeOffset]::UtcNow.ToString('o');backup=$BackupPath;archive=$blob;applied=[bool]$Apply;result='Succeeded'}|ConvertTo-Json|Set-Content -LiteralPath data/deploy/reactivation-restore.json -Encoding utf8
} finally {
  foreach($roleId in $temporaryRoles){
    if($roleId){Invoke-NogalAz role assignment delete --ids $roleId --only-show-errors|Out-Null}
  }
}
