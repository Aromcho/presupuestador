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
if exist gesetec-deploy.tar.gz del gesetec-deploy.tar.gz
tar -czf gesetec-deploy.tar.gz --exclude=node_modules --exclude=.next --exclude=.next-new --exclude=dist --exclude=.env --exclude=.env.local --exclude=uploads apps deploy scripts package.json package-lock.json docker-compose.yml README.md PLAN.md || goto error
scp gesetec-deploy.tar.gz %SERVER%:/tmp/gesetec-deploy.tar.gz || goto error
ssh -t %SERVER% "tar -xzf /tmp/gesetec-deploy.tar.gz -C /var/www/gesetec-presupuestador && cd /var/www/gesetec-presupuestador && bash deploy/update.sh" || goto error
echo.
echo  Listo: https://presupuestos.gesetecalderas.com
pause
goto :eof
:error
echo.
echo  Algo fallo. Sacale una captura a esta ventana y pasamela.
pause
