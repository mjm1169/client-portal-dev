On load
$env:PATH="C:\Users\Matty.Mason\tools\node-v20.20.0-win-x64;" + $env:PATH
swa start ./frontend --api-location ./api 

If 401
http://localhost:4280/.auth/login/aad