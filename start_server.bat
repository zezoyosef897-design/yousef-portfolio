@echo off
echo =======================================
echo Starting Yousef Abdo Portfolio Server
echo =======================================
echo.
echo Please do not close this window! If you close it, the website will stop working.
echo Go to your browser and open: http://localhost:3000
echo.

set PATH=%PATH%;C:\Program Files\nodejs

node server.js
pause
