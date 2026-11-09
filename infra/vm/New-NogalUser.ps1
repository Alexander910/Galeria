param(
  [Parameter(Mandatory=$true)][string]$Username,
  [Parameter(Mandatory=$true)][string]$DisplayName,
  [Security.SecureString]$Password,
  [string]$ResourceGroup='nogal-final',
  [ValidateSet('nogal-app-1','nogal-app-2')][string]$VmName='nogal-app-1',
  [switch]$Apply
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if(-not $Password){$Password=Read-Host 'Contraseña nueva de al menos 12 caracteres' -AsSecureString}
$pointer=[IntPtr]::Zero
try{
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
  $inputJson=@{username=$Username;name=$DisplayName;password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}|ConvertTo-Json -Compress
  $oldOutputEncoding=$OutputEncoding
  try{
    $OutputEncoding=[Text.UTF8Encoding]::new($false)
    $scriptText=$inputJson|& node (Join-Path $PSScriptRoot 'manage-users.cjs') prepare
    if($LASTEXITCODE -ne 0){throw 'No se pudo preparar la cuenta.'}
  }finally{$OutputEncoding=$oldOutputEncoding}
}finally{
  $inputJson=$null
  if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
}
$directory=Join-Path $projectRoot 'data/deploy'
New-Item -ItemType Directory -Path $directory -Force|Out-Null
$file=Join-Path $directory ('new-user-'+[guid]::NewGuid().ToString()+'.sh')
[IO.File]::WriteAllText($file,($scriptText -join "`n").Replace("`r",''),[Text.UTF8Encoding]::new($false))
if(-not $Apply){
  Write-Output ('Script privado preparado: '+$file)
  Write-Output 'En Azure Portal: VM de aplicación > Operaciones > Ejecutar comando > RunShellScript. Pega este script y ejecuta.'
  Write-Output 'Contiene un hash de acceso. No lo compartas. Elimínalo después de utilizarlo.'
  return
}
try{
  $messages=& (Join-Path $projectRoot 'infra/az.ps1') vm run-command invoke -g $ResourceGroup -n $VmName --command-id RunShellScript --scripts ('@'+$file) --query 'value[].message' -o tsv --only-show-errors
  if($LASTEXITCODE -ne 0 -or ($messages -join "`n") -notmatch 'NOGAL_USER_CREATED'){throw 'Azure no confirmó el alta. Comprueba que la infraestructura esté activa y tenga desplegada esta versión.'}
  $messages|Write-Output
}finally{Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue}
