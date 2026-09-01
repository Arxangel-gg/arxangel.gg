@echo off
REM ==========================================================================
REM  ARXANGEL - RELEASE CONSOLE
REM  Double-click this file whenever a new track is out and the site needs to
REM  catch up. All the actual work lives in tools\arx.py.
REM ==========================================================================
setlocal
cd /d "%~dp0"

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY where py >nul 2>&1 && set "PY=py -3"

if not defined PY (
  echo.
  echo   Python was not found on this PC.
  echo   Install it from https://www.python.org/downloads/
  echo   ^(tick "Add python.exe to PATH" during setup^), then run this again.
  echo.
  pause
  exit /b 1
)

%PY% tools\arx.py %*
