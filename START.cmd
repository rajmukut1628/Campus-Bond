@echo off
setlocal
set "PATH=%SystemRoot%\System32;%PATH%"
set "ComSpec=%SystemRoot%\System32\cmd.exe"
cd /d "%~dp0"
call npm run dev
pause
