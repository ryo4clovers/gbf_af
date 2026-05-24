
@echo off
setlocal
pushd "%~dp0\.." >nul

set "VENV_DIR=.venv"

echo Removing %VENV_DIR%...
if exist "%VENV_DIR%" (
    echo Deleting %VENV_DIR%...
    rmdir /s /q "%VENV_DIR%" || (
        echo Failed to delete %VENV_DIR%
        pause
        exit /b 1
    )
)

echo Locating Python exe...
set "PY_EXEC="
where py >nul 2>&1 && set "PY_EXEC=py -3"
if "%PY_EXEC%"=="" (
    where python >nul 2>&1 && set "PY_EXEC=python"
)
if "%PY_EXEC%"=="" (
    echo Not found Python in PATH. Install Python or add it to PATH.
    pause
    exit /b 1
)
%PY_EXEC% -V

echo Creating %VENV_DIR%...
%PY_EXEC% -m venv %VENV_DIR%
if errorlevel 1 (
    echo Failed to create %VENV_DIR%. Ensure Python can create venvs.
    pause
    exit /b 1
)

echo Upgrading pip...
%VENV_DIR%\Scripts\python -m pip install --upgrade pip

echo Installing packages...
if exist "requirements.txt" (
    %VENV_DIR%\Scripts\python -m pip install -r requirements.txt
) else (
    echo requirements.txt not found. Skipping package installation.
)

%VENV_DIR%\Scripts\python -m pip list

popd >nul
echo Success.
pause
