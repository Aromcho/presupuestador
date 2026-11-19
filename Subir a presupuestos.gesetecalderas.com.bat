@echo off
chcp 65001 >nul
title Gesetec - subir el panel admin a presupuestos.gesetecalderas.com
cd /d "%~dp0"
echo.
echo  GESETEC - instalar el panel admin en https://presupuestos.gesetecalderas.com
echo  ------------------------------------------------------------------------------
echo  Antes: el subdominio presupuestos.gesetecalderas.com tiene que apuntar (registro A) a la IP del VPS.
echo.
where ssh >nul 2>nul || (echo  Falta el cliente SSH de Windows: Configuracion ^> Aplicaciones ^> Caracteristicas opcionales ^> Cliente OpenSSH. & pause & exit /b 1)
set /p SERVER= Usuario e IP del VPS (ej: root@123.45.67.89): 
if "%SERVER%"=="" exit /b 1
echo.
echo  1/2 Subiendo tus cambios a GitHub (Aromcho/presupuestador)...
git push || goto error
rem Instalacion desde cero o reinstalacion. Para las actualizaciones de todos los dias usa "Actualizar presupuestos.gesetecalderas.com.bat" o el deploy "presupuestador" desde Claude.
echo.
echo  2/2 Instalando en el servidor, en /root/gesetec-presupuestador (unos 5 minutos)...
ssh -t %SERVER% "test -d /root/gesetec-presupuestador/.git || git clone https://github.com/Aromcho/presupuestador.git /root/gesetec-presupuestador; cd /root/gesetec-presupuestador && git checkout -- apps/web/tsconfig.json 2>/dev/null; git pull --ff-only && sudo bash deploy/install.sh presupuestos.gesetecalderas.com" || goto error
echo.
rem install.sh se puede volver a correr: no pisa los .env, la base ni las fotos.
echo  Si el certificado HTTPS fallo, revisa el DNS y volve a correr este archivo.
echo.
echo  Listo: https://presupuestos.gesetecalderas.com
echo  Anota las contrasenas que aparecen arriba.
pause
goto :eof
:error
echo.
echo  Algo fallo. Sacale una captura a esta ventana y pasamela.
pause
