# Análisis: Autenticación de Profesionales - BookMyProject

## Diagnóstico del Problema

### Estado Actual
1. **Modelo Profesional** (`src/prisma/schema.prisma`):
   - Almacena: id, nombre, biografía, imagen, phone, state, sedeId
   - **NO tiene relación** con Users
   - **NO tiene credenciales** (UserAuth)

2. **Flujo de Autenticación**:
   - Login requiere: email + password
   - Las credenciales están en tabla `UserAuth` (1:1 con Users)
   - `Users` contiene el rol (EMPLOYEE, CLIENT, etc.)
   - Un usuario sin registro en `UserAuth` NO puede iniciar sesión

3. **Profesionales Existentes**:
   - Existen registros en tabla `profesionales`
   - Pero NO existe registro en tabla `users` para ellos
   - Por lo tanto **NO pueden iniciar sesión**

### Por Qué No Pueden Iniciar Sesión
```
Flujo Actual de Login:
LoginDto (email, password) 
  → UserAuth.findUnique({ email }) ❌ NO EXISTE
  → Error "Usuario no encontrado"
```

## Solución Propuesta

### 1. **Cambios en el Esquema Prisma**

#### Paso 1: Agregar Relación en Modelo Profesional
```prisma
model Profesional {
  // ... campos existentes
  userId        Int?      @unique @map("user_id")
  user          Users?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@map("profesionales")
}

model Users {
  // ... campos existentes
  profesional   Profesional?
}
```

**Beneficios**:
- Profesional puede tener usuario (1:1 opcional)
- Permitir que profesionales sin usuario (legado) existan
- Eventualmente migrar al 1:1 requerido

---

### 2. **Migración de Profesionales Existentes**

#### Script Prisma Migration:
```sql
-- Crear tabla temporal para mapeos
CREATE TABLE profesional_user_mapping (
  profesional_id INT UNIQUE,
  user_id INT UNIQUE,
  FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migración automática podría:
-- 1. Para cada Profesional sin User
-- 2. Crear registro en Users con clientType='employee', role='EMPLOYEE'
-- 3. Crear entrada en UserAuth con contraseña temporal
-- 4. Vincular Profesional.userId = Users.id
-- 5. Enviar email/SMS con credenciales
```

---

### 3. **Cambios en Creación de Profesionales**

#### En `ProfesionalService.create()`:

**Opción A: Creación Manual de Profesional** (sin Users automático)
- Admin crea profesional vía endpoint
- Profesional queda pendiente de registro
- Después, profesional usa endpoint de "Crear mis credenciales"

**Opción B: Creación Automática** (RECOMENDADO)
- Admin crea profesional
- Automáticamente se crea Users + UserAuth
- Se genera contraseña temporal o se envía vía SMS/email
- Profesional recibe credenciales

**Recomendación**: Opción B es más fluida para el usuario

---

### 4. **Cambios Requeridos**

#### A. Base de Datos (Prisma)
- [ ] Agregar campo `userId` en Profesional
- [ ] Crear migration
- [ ] Script para migrar datos existentes

#### B. Backend (NestJS)

**En `ProfesionalService.create()`**:
```typescript
async create(createProfesionalDto: CreateProfesionalDto, ...) {
  // Crear Profesional
  const profesional = await this.prisma.profesional.create({...});
  
  // Crear User + UserAuth automáticamente
  const user = await this.prisma.users.create({
    data: {
      email: profesional.phone + '@bookmyproject.local',
      clientType: ClientType.employee,
      role: Role.EMPLOYEE,
      state: ClientState.enabled,
      UserAuth: {
        create: {
          email: profesional.phone + '@bookmyproject.local',
          password: hashedTempPassword
        }
      },
      UserData: {
        create: {
          name: profesional.nombre,
          phone: profesional.phone,
          // ... otros campos requeridos
        }
      }
    }
  });
  
  // Vincular
  await this.prisma.profesional.update({
    where: { id: profesional.id },
    data: { userId: user.id }
  });
  
  return { profesional, user, tempPassword };
}
```

**En `AuthService`** - Nuevo endpoint para "Completar Registro":
```typescript
async completeProfessionalRegistration(
  profesionalId: number,
  email: string,
  password: string
) {
  // Buscar Profesional
  // Actualizar UserAuth con email/password real
  // Cambiar estado
}
```

#### C. DTOs
- **CreateProfesionalDto**: Sin cambios (user_id se asigna automático)
- **Nuevo endpoint**: `PATCH /profesionales/:id/setup-credentials`

#### D. Migrations
1. Crear migration: `add-user-relation-to-profesional`
2. Crear migration: `migrate-existing-profesionales-to-users`

---

### 5. **Flujo Post-Solución**

#### Profesionales Existentes
```
1. Admin crea migración
   → Profesionales existentes obtienen Users automáticamente
   
2. Profesional recibe email/SMS con:
   - Email (teléfono@bookmyproject.local)
   - Contraseña temporal
   
3. Profesional cambia contraseña
   → Ya tiene acceso completo (role: EMPLOYEE)
```

#### Nuevo Profesional
```
1. Admin crea Profesional vía API
   → Automáticamente se crea Users + UserAuth
   
2. Se genera contraseña temporal
   
3. Se envía email/SMS (OPCIONAL)
   → Profesional cambia contraseña
   → Login exitoso
```

#### Login Profesional
```
LoginDto:
  email: teléfono o email real
  password: contraseña establecida
  
→ UserAuth.findUnique({ email })
→ Verificar password
→ Generar JWT (rol: EMPLOYEE)
→ Acceso concedido ✅
```

---

## Cambios Específicos por Archivo

### 1. `prisma/schema.prisma`
- [ ] Agregar `userId` a Profesional
- [ ] Agregar relación `Users.profesional`

### 2. `src/data/profesional/profesional.service.ts`
- [ ] Modificar `.create()` para crear Users + UserAuth
- [ ] Agregar transacción
- [ ] Manejar errores

### 3. `src/auth/auth.service.ts`
- [ ] Nuevo método `completeProfessionalRegistration()`
- [ ] Nuevo método `setupProfessionalCredentials()`

### 4. `src/auth/controllers/admin-management.controller.ts`
- [ ] Nuevo endpoint: `PATCH /admin/profesionales/:id/credentials`

### 5. Archivos Nuevos
- [ ] `prisma/migrations/[timestamp]_add_user_to_profesional.sql`
- [ ] `prisma/migrations/[timestamp]_migrate_profesionales.sql`
- [ ] `src/auth/dto/setup-professional-credentials.dto.ts`

---

## Consideraciones Importantes

### ✅ Ventajas
- Profesionales pueden iniciar sesión como EMPLOYEE
- Rol definido claramente
- Auditoría completa (Users.createdAt, updatedAt)
- Cambio de contraseña nativo

### ⚠️ Riesgos
- Migración requiere crear Users para todos los profesionales
- Necesita manejo de errores en caso de email duplicado
- Considerar qué pasa con profesionales archivados

### 🔧 Pasos de Implementación
1. **Crear migration**: Agregar campo `userId`
2. **Script de migración**: Poblar datos existentes
3. **Pruebas**: Verificar que profesionales antiguos funcionen
4. **Actualizar `.create()`**: Crear Users automáticamente
5. **Tests unitarios**: E2E de todo el flujo

---

## Preguntas Abiertas

1. **Email único**: ¿Cómo manejar profesionales sin email en sistema actual?
   - Opción: Usar `teléfono@bookmyproject.local` como fallback
   
2. **Contraseña temporal**: ¿Cómo distribuir?
   - Email: Requiere correo válido
   - SMS: Requiere Twilio (ya configurado)
   - Panel: Admin comparte manualmente
   
3. **Cambio de correo después**: ¿Permitir cambiar email de UserAuth?
   - Sí, pero mantener único
   
4. **Desactivar Profesional**: ¿Desactivar también el User?
   - Sí, mantener consistencia

---

## Prioridad
**ALTA** - Bloquea la funcionalidad principal de login para profesionales
