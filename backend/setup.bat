@echo off
echo Installing Savannah Cinemas Backend Dependencies...
echo.
npm install bcryptjs jsonwebtoken mongoose dotenv cors nodemailer express
echo.
echo Installation complete!
echo.
echo Starting server...
node server.js
pause