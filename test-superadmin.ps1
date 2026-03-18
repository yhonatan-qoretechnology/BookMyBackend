$body = @{
    name = "Root Super Admin"
    phone = "8001112242"
    email = "superadmin@example.com"
    password = "Admin123$"
    gender = " "
    idioma = "es"
    countryId = 1
    birthdate = "1990-01-15"
    clientType = "business"
    state = "enabled"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/auth/bootstrap-super-admin" -Method POST -ContentType "application/json" -Body $body
