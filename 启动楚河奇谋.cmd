@echo off
cd /d "%~dp0"
start "" http://localhost:3188
node server.mjs
pause
