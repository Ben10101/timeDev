@echo off
REM Test script to run Python factory directly
REM Run this from the command line to test the factory

cd /d "%~dp0\..\.."
echo [TEST] Running Aligna agent smoke test...
echo.

python tests\test_agents_direct.py

echo.
echo [DONE] Test completed!
pause
