@echo off
echo === Pushing Draft Board to GitHub ===
cd /d "%~dp0"

REM Remove any old broken .git directory
if exist ".git" (
    echo Removing old .git directory...
    rmdir /s /q ".git"
)

REM Initialize fresh git repo
git init -b main
git add -A
git commit -m "Initial commit: Draft Board app"

REM Set remote (force replace if exists)
git remote remove origin 2>nul
git remote add origin https://github.com/eesamerchant/draft-board.git

REM Force push to overwrite empty repo
git push -u origin main --force

echo.
echo === Done! Code is now on GitHub ===
echo Vercel will automatically detect the push and start deploying.
echo.
pause
