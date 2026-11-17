@echo off
chcp 65001 >nul
title Gesetec - actualizar el presupuestador
cd /d "%~dp0"
echo.
echo  GESETEC - actualizar el presupuestador (no toca la base, los .env ni las fotos)
echo  -----------------------------------------------------------------------------
where ssh >nul 2>nul || (echo  Falta el cliente SSH de Windows. & pause & exit /b 1)
set /p SERVER= Usuario e IP del VPS (ej: root@123.45.67.89): 
if "%SERVER%"=="" exit /b 1
echo  1/2 Subiendo tus cambios a GitHub...
git push || goto error
echo  2/2 Actualizando el servidor (tambien se puede hacer desde Claude con el deploy "presupuestador")...
ssh -t %SERVER% "cd /root/gesetec-presupuestador && git checkout -- apps/web/tsconfig.json && git pull --ff-only && bash deploy/update.sh && git checkout -- apps/web/tsconfig.json" || goto error
echo.
echo  Listo: https://presupuestos.gesetecalderas.com
pause
goto :eof
:error
echo.
echo  Algo fallo. Sacale una captura a esta ventana y pasamela.
pause
