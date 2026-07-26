@echo off
setlocal
pushd "%~dp0"

docker.exe info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not reachable. Start Docker Desktop, then run this command again.
  popd
  exit /b 1
)

docker.exe compose down --remove-orphans
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo Team Job Workflow was not stopped successfully.
  popd
  exit /b %EXIT_CODE%
)

echo Team Job Workflow containers stopped. The local PostgreSQL demo volume was retained.
popd
exit /b 0
