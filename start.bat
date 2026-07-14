@echo off
echo =========================================
echo   MyQA@JN — Starting All Services
echo =========================================

:: Kill existing processes on ports 3000, 5000 and 8010
echo Stopping existing services on ports 3000, 5000 and 8010...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8010 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Postgres via Docker Compose
echo Starting Postgres (Docker)...
docker compose -f "%~dp0docker-compose.yml" up -d

:: Start Ollama (llama3.2) — skip if already running
echo Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Ollama...
    start "Ollama llama3.2" cmd /k "ollama serve"
    timeout /t 3 /nobreak >nul
) else (
    echo Ollama already running.
)

:: Start Backend
echo Starting Backend (port 5000)...
start "MyQA@JN Backend" cmd /k "cd /d %~dp0backend && node src/app.js"

:: Train classifier if model not yet exists
if not exist "%~dp0ai-engine\models\classifier_model.pkl" (
    echo Training ML classifier for Agent A...
    cd /d "%~dp0ai-engine"
    call venv\Scripts\activate
    venv\Scripts\python.exe train_classifier.py >nul 2>&1
    echo Classifier model ready.
) else (
    echo Classifier model already exists, skipping training.
)

:: Start AI Engine
echo Starting AI Engine (port 8010)...
start "MyQA@JN AI Engine" cmd /k "cd /d %~dp0ai-engine && set GDRIVE_SKIP_REAL=1 && call venv\Scripts\activate && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8010 --reload"

:: Start Frontend
echo Starting Frontend (port 3000)...
start "MyQA@JN Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =========================================
echo   Semua servis dah start!
echo   Ollama   : http://localhost:11434  (llama3.2)
echo   Backend  : http://localhost:5000
echo   AI Engine: http://localhost:8010
echo   Frontend : http://localhost:3000
echo =========================================
echo   Buka browser: http://localhost:3000
echo =========================================
