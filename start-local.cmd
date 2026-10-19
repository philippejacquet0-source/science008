@echo off
cd /d "%~dp0"
set "FORAGES_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%FORAGES_NODE%" (
  "%FORAGES_NODE%" server.mjs --open
) else (
  node server.mjs --open
)
pause
