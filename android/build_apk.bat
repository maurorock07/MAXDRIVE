@echo off
echo ==========================================
echo 🚀 INICIANDO COMPILACAO DO APK MAX DRIVE
echo ==========================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ANDROID_HOME=C:\Users\mauro\AppData\Local\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Users\mauro\AppData\Local\Android\Sdk"

cd /d "d:\MAXDRIVE\android"

echo Compilando com Gradle...
call gradlew.bat assembleDebug --stacktrace

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo ✅ APK COMPILADO COM SUCESSO!
    echo ==========================================
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\MAXDRIVE.apk"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "d:\MAXDRIVE\MAXDRIVE.apk"
    echo APK copiado para: d:\MAXDRIVE\MAXDRIVE.apk
) else (
    echo.
    echo ❌ Erro na compilacao do APK.
)
