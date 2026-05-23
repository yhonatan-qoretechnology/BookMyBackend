# Diagrama: Arquitectura de Autenticación para Profesionales

## Estado ACTUAL (Problema)

```
PROFESIONAL                      USERS                          USERAUTH
├─ id                            ├─ id ✅                       ├─ id
├─ nombre                        ├─ email ✅                    ├─ email ✅
├─ phone ✅ UNIQUE               ├─ role ✅                     ├─ password ✅
├─ sedeId                        ├─ state                       ├─ user_id (FK Users)
├─ createdAt                     ├─ createdAt
└─ ...                           └─ ...

        ❌ NO VINCULADOS
        ❌ Profesional sin Users = NO puede login
```

---

## Estado DESEADO (Solución)

```
PROFESIONAL                      USERS                          USERAUTH
├─ id                            ├─ id ✅                       ├─ id
├─ nombre                        ├─ email ✅                    ├─ email ✅
├─ phone ✅ UNIQUE               ├─ role = EMPLOYEE ✅          ├─ password ✅
├─ sedeId                        ├─ clientType = employee       ├─ user_id (FK Users)
├─ createdAt                     ├─ state
├─ userId (NUEVO) ✅ 1:1         ├─ createdAt
└─ ...                           └─ profesional (relación) ✅

        ✅ VINCULADO 1:1
        ✅ Profesional siempre tiene Users
        ✅ Profesional puede iniciar sesión
```

---

## Flujos

### Flujo 1: Crear Nuevo Profesional

```
┌─────────────────────────────────────────────────────────┐
│ Admin: POST /profesionales                              │
│ {                                                       │
│   "nombre": "Juan",                                     │
│   "phone": "+34 600 123 456",                          │
│   "sedeId": 5                                           │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ⬇️
                  ProfesionalService.create()
                        ⬇️
┌─────────────────────────────────────────────────────────┐
│ 1. Crear Profesional                                    │
│    INSERT INTO profesionales (nombre, phone, sedeId)   │
│    → profesional_id = 123                              │
│                                                         │
│ 2. Crear Users (AUTOMÁTICO)                            │
│    INSERT INTO users (                                 │
│      email: "+34600123456@bookmyproject.local",       │
│      role: EMPLOYEE,                                   │
│      clientType: employee,                            │
│      state: enabled                                    │
│    )                                                   │
│    → user_id = 456                                     │
│                                                         │
│ 3. Crear UserAuth (AUTOMÁTICO)                         │
│    INSERT INTO user_auth (                             │
│      email: "+34600123456@bookmyproject.local",       │
│      password: hash(tempPassword)                      │
│    )                                                   │
│    → auth_id = 789                                     │
│                                                         │
│ 4. Crear UserData (AUTOMÁTICO)                         │
│    INSERT INTO user_data (                             │
│      name: "Juan",                                     │
│      phone: "+34 600 123 456",                        │
│      user_id: 456                                      │
│    )                                                   │
│                                                         │
│ 5. Vincular Profesional → Users                        │
│    UPDATE profesionales SET user_id = 456              │
│    WHERE id = 123                                      │
└─────────────────────────────────────────────────────────┘
                        ⬇️
┌─────────────────────────────────────────────────────────┐
│ Response:                                               │
│ {                                                       │
│   "profesional": { ... },                              │
│   "tempPassword": "X#k9$mP2@vQ",                       │
│   "email": "+34600123456@bookmyproject.local"          │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

---

### Flujo 2: Login Profesional (Nuevo)

```
┌─────────────────────────────────────────────────────────┐
│ Profesional: POST /auth/login                           │
│ {                                                       │
│   "email": "+34600123456@bookmyproject.local",         │
│   "password": "suContraseña123"                        │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ⬇️
                  AuthService.login()
                        ⬇️
┌─────────────────────────────────────────────────────────┐
│ 1. SELECT * FROM user_auth WHERE email = "..."         │
│    → Encontrado ✅                                      │
│                                                         │
│ 2. Validar password                                     │
│    bcrypt.compare(pwd, hash) → true ✅                │
│                                                         │
│ 3. SELECT * FROM users WHERE id = 456                  │
│    → role: EMPLOYEE ✅                                 │
│                                                         │
│ 4. Generar JWT token                                   │
│    payload: {                                           │
│      userId: 456,                                       │
│      email: "+34600123456@...",                        │
│      role: EMPLOYEE                                    │
│    }                                                   │
│    → token = "eyJhbGc..."                              │
└─────────────────────────────────────────────────────────┘
                        ⬇️
┌─────────────────────────────────────────────────────────┐
│ Response:                                               │
│ {                                                       │
│   "access_token": "eyJhbGc...",                        │
│   "user": {                                             │
│     "id": 456,                                          │
│     "email": "+34600123456@bookmyproject.local",       │
│     "role": "EMPLOYEE"                                 │
│   }                                                     │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

---

### Flujo 3: Profesional Existente (Sin User)

```
┌──────────────────────────────────────────────────────────────┐
│ ANTES: Profesional sin User                                 │
│ profesionales.id = 123                                       │
│ profesionales.userId = NULL                                 │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
┌──────────────────────────────────────────────────────────────┐
│ Admin: PATCH /admin/profesionales/123/setup-credentials      │
│ {                                                            │
│   "email": "juan@example.com",                              │
│   "password": "MiContraseña123!",                           │
│   "profesionalId": 123                                       │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
            AuthService.setupProfessionalCredentials()
                           ⬇️
┌──────────────────────────────────────────────────────────────┐
│ 1. SELECT * FROM profesionales WHERE id = 123               │
│    → Encontrado, userId = NULL ✅                            │
│                                                              │
│ 2. INSERT INTO users (                                       │
│      email: "juan@example.com",                             │
│      role: EMPLOYEE,                                         │
│      clientType: employee                                    │
│    )                                                         │
│    → user_id = 789                                           │
│                                                              │
│ 3. INSERT INTO user_auth (                                   │
│      email: "juan@example.com",                             │
│      password: hash("MiContraseña123!")                     │
│    )                                                         │
│                                                              │
│ 4. UPDATE profesionales SET user_id = 789                    │
│    WHERE id = 123                                            │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
┌──────────────────────────────────────────────────────────────┐
│ DESPUÉS: Profesional con User vinculado ✅                   │
│ profesionales.id = 123                                       │
│ profesionales.userId = 789                                  │
│                                                              │
│ Ahora puede iniciar sesión:                                 │
│ email: juan@example.com                                      │
│ password: MiContraseña123!                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Cambios en Esquema SQL

```sql
-- CAMBIO 1: Agregar column a profesionales
ALTER TABLE profesionales ADD COLUMN user_id INT UNIQUE;
ALTER TABLE profesionales ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- ÍNDICE
CREATE INDEX idx_profesionales_user_id ON profesionales(user_id);
```

---

## Permisos/Roles: ANTES vs DESPUÉS

### ANTES
```
Profesional → No tiene Users → No tiene Role
            → No puede iniciar sesión
            → No tiene acceso a endpoints protegidos
```

### DESPUÉS
```
Profesional → Users.role = EMPLOYEE
            → Puede iniciar sesión
            → Acceso a endpoints para role EMPLOYEE
            
            Permisos:
            ✅ Ver citas (Appointments)
            ✅ Actualizar disponibilidad
            ✅ Cambiar contraseña
            ✅ Ver datos de su perfil
            ❌ Ver datos de otros profesionales
            ❌ Crear otros profesionales
```

---

## Timeline de Datos

### Momento 1: Se crea Profesional (Sin User)
```
profesionales:
  id=123, nombre='Juan', phone='+34600...', sedeId=5, user_id=NULL

users: (vacío, sin registro para Juan)
```

### Momento 2: Admin asigna credenciales
```
profesionales:
  id=123, nombre='Juan', phone='+34600...', sedeId=5, user_id=456

users:
  id=456, email='juan@example.com', role=EMPLOYEE, ...

user_auth:
  id=789, email='juan@example.com', password=hash(...), user_id=456

user_data:
  id=999, name='Juan', phone='+34600...', user_id=456
```

### Momento 3: Profesional inicia sesión
```
Payload JWT generado:
{
  "userId": 456,
  "email": "juan@example.com",
  "role": "EMPLOYEE",
  "iat": 1234567890,
  "exp": 1234571490
}

Profesional autenticado ✅
```

---

## Tabla Comparativa

| Funcionalidad | Antes | Después |
|---|---|---|
| Crear Profesional | ✅ Rápido | ✅ Rápido (+ crea User auto) |
| Profesional inicia sesión | ❌ Imposible | ✅ Posible |
| Cambiar contraseña | ❌ N/A | ✅ Método nativo |
| Ver perfil como EMPLOYEE | ❌ No hay token | ✅ Con JWT |
| Crear cita como profesional | ❌ No autorizado | ✅ Autorizado (EMPLOYEE) |
| Admin gestiona | ✅ Solo CRUD profesional | ✅ CRUD profesional + usuario |

---

## Preguntas Técnicas Frecuentes

### ¿Y si un profesional tiene múltiples cuentas?
→ Relación 1:1, no es posible. Un profesional = un usuario.

### ¿Y si el admin quiere cambiar el email de un profesional?
→ Actualizar Users.email y UserAuth.email de forma atómica.

### ¿Qué pasa con profesionales antiguos sin email?
→ Usar `phone@bookmyproject.local` como email temporal.

### ¿Cómo expira la contraseña temporal?
→ Se cambia en el primer login (validación en frontend/backend).

### ¿Quién puede cambiar contraseña?
→ El profesional mismo (EMPLOYEE) o SUPER_ADMIN.
