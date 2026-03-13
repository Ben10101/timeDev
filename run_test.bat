@echo off
REM Test script to run Python factory directly
REM Run this from the command line to test the factory

cd /d "%~dp0"
echo [TEST] Running AI Software Factory test...
echo.

python test_agents_direct.py

echo.
echo [DONE] Test completed!
pause
