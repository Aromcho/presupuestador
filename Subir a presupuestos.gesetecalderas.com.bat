@echo off
chcp 65001 >nul
title Gesetec - subir el presupuestador a presupuestos.gesetecalderas.com
cd /d "%~dp0"
echo.
echo  GESETEC - instalar el presupuestador en https://presupuestos.gesetecalderas.com
echo  ------------------------------------------------------------------------------
echo  Antes: el subdominio presupuestos.gesetecalderas.com tiene que apuntar (registro A) a la IP del VPS.
echo.
where ssh >nul 2>nul || (echo  Falta el cliente SSH de Windows: Configuracion ^> Aplicaciones ^> Caracteristicas opcionales ^> Cliente OpenSSH. & pause & exit /b 1)
set /p SERVER= Usuario e IP del VPS (ej: root@123.45.67.89): 
if "%SERVER%"=="" exit /b 1
echo.
echo  1/3 Empaquetando el proyecto...
if exist gesetec-deploy.tar.gz del gesetec-deploy.tar.gz
tar -czf gesetec-deploy.tar.gz --exclude=node_modules --exclude=.next --exclude=.next-new --exclude=dist --exclude=.env --exclude=.env.local --exclude=uploads apps deploy scripts package.json package-lock.json docker-compose.yml README.md PLAN.md || goto error
echo.
echo  2/3 Subiendo...
scp gesetec-deploy.tar.gz %SERVER%:/tmp/gesetec-deploy.tar.gz || goto error
echo.
echo  3/3 Instalando en el servidor (unos 5 minutos)...
ssh -t %SERVER% "mkdir -p /var/www/gesetec-presupuestador && tar -xzf /tmp/gesetec-deploy.tar.gz -C /var/www/gesetec-presupuestador && cd /var/www/gesetec-presupuestador && sudo bash deploy/install.sh presupuestos.gesetecalderas.com" || goto error
echo.
echo  Listo: https://presupuestos.gesetecalderas.com
echo  Anota las contrasenas que aparecen arriba.
pause
goto :eof
:error
echo.
echo  Algo fallo. Sacale una captura a esta ventana y pasamela.
pause
