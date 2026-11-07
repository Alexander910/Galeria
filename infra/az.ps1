$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:AZURE_CONFIG_DIR = Join-Path $projectRoot '.tools\azure-config'
$env:AZURE_CORE_ENABLE_BROKER_ON_WINDOWS = 'false'
$env:AZURE_CORE_COLLECT_TELEMETRY = 'false'
$pythonExecutable = 'C:\Users\usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:NOGAL_AZURE_CLI_PATH = Join-Path $projectRoot '.tools\azure-cli'
& $pythonExecutable -c "import os,site,runpy;site.addsitedir(os.environ['NOGAL_AZURE_CLI_PATH']);runpy.run_module('azure.cli',run_name='__main__')" @args
exit $LASTEXITCODE
