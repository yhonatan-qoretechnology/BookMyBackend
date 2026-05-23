# Plan de Implementación: Login para Profesionales

## Resumen Ejecutivo
Los profesionales existentes no pueden iniciar sesión porque:
- La tabla `Profesional` NO tiene relación con tabla `Users`
- El login requiere email + password en tabla `UserAuth` (vinculada a `Users`)
- **Solución**: Vincular Profesional ↔ Users (1:1) y crear Users para profesionales

---

## Etapas de Implementación

### ETAPA 1: Cambio de Schema (Base de Datos)

#### 1.1 Crear Migration Prisma
```bash
npx prisma migrate dev --name add_user_to_profesional
```

**Cambios en schema.prisma**:
```prisma
model Profesional {
  // ... campos existentes
  userId        Int?      @unique @map("user_id")
  user          Users?    @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model Users {
  // ... campos existentes
  profesional   Profesional?
}
```

**Nota**: `userId` es OPCIONAL para no romper profesionales existentes

#### 1.2 Script SQL de Migración (crear en `prisma/migrations/[timestamp]_migrate_existing_profesionales.sql`)
```sql
-- Este script crea Users para Profesionales sin User
-- Se ejecuta MANUALMENTE después de la migración anterior

-- NO IMPLEMENTAR AÚN - Depende de cómo generar contraseña temporal
-- Opción A: Usar hash del teléfono
-- Opción B: Contraseña aleatoria guardada en archivo
-- Opción C: Enviar por email/SMS
```

---

### ETAPA 2: Servicio de Autenticación para Profesionales

#### 2.1 Crear DTO nuevo
**Archivo**: `src/auth/dto/register-professional.dto.ts`
```typescript
export class RegisterProfessionalDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNumber()
  @IsNotEmpty()
  profesionalId: number; // ID del profesional a vincular
}
```

#### 2.2 Método en `AuthService`
```typescript
async registerProfessionalUser(dto: RegisterProfessionalDto) {
  // 1. Verificar que Profesional existe y NO tiene User
  // 2. Verificar que email no existe
  // 3. Crear Users + UserAuth + UserData
  // 4. Vincular con Profesional
  // 5. Retornar token o mensaje de éxito
}
```

---

### ETAPA 3: Cambio en Creación de Profesional

#### 3.1 Modificar `ProfesionalService.create()`

**Opción A: RECOMENDADA - Crear User automáticamente**
```typescript
async create(createProfesionalDto: CreateProfesionalDto, user?, file?) {
  // ... validaciones existentes
  
  const profesional = await this.prisma.profesional.create({
    data: { ...createProfesionalDto, imagen: imagenPath }
  });
  
  // NUEVO: Crear User automáticamente
  const tempPassword = generateTemporaryPassword();
  const createdUser = await this.prisma.users.create({
    data: {
      email: createProfesionalDto.phone + '@bookmyproject.local',
      clientType: ClientType.employee,
      role: Role.EMPLOYEE,
      state: ClientState.enabled,
      UserAuth: {
        create: {
          email: createProfesionalDto.phone + '@bookmyproject.local',
          password: await this.hashService.hash(tempPassword)
        }
      },
      UserData: {
        create: {
          name: createProfesionalDto.nombre,
          phone: createProfesionalDto.phone,
          email: createProfesionalDto.phone + '@bookmyproject.local',
          countryId: 1, // PENDING: obtener del contexto
          idioma: 'es'
        }
      }
    }
  });
  
  // Vincular
  await this.prisma.profesional.update({
    where: { id: profesional.id },
    data: { userId: createdUser.id }
  });
  
  return {
    profesional,
    user: createdUser,
    tempPassword // IMPORTANTE: mostrar una sola vez
  };
}
```

---

### ETAPA 4: Endpoint para Profesionales Existentes

#### 4.1 Crear Endpoint
**En** `src/auth/controllers/admin-management.controller.ts`

```typescript
@Patch('profesionales/:id/setup-credentials')
async setupProfessionalCredentials(
  @Param('id', ParseIntPipe) profesionalId: number,
  @Body() dto: RegisterProfessionalDto,
  @AuthUser() user: AuthenticatedUser
) {
  // Validar que es admin
  // Crear/Actualizar credentials del profesional
  // Retornar token o confirmación
}
```

#### 4.2 Implementar en `AuthService`
```typescript
async setupProfessionalCredentials(
  profesionalId: number,
  email: string,
  password: string
) {
  // 1. Verificar Profesional existe
  // 2. Si no tiene User: crear
  // 3. Si tiene User: actualizar credenciales
  // 4. Retornar confirmación
}
```

---

### ETAPA 5: Validación

#### 5.1 Tests Unitarios
- [ ] Crear Profesional → Crear User automáticamente
- [ ] Login con email de profesional
- [ ] Login con teléfono + password
- [ ] Cambio de contraseña
- [ ] Profesional existente → Crear credenciales

#### 5.2 Tests E2E
```
1. Admin crea Profesional
   → User creado automáticamente
   
2. Profesional recibe credenciales
   → Login exitoso
   
3. Cambiar contraseña
   → Nueva contraseña funciona
   
4. Profesional antiguo (sin User)
   → Admin asigna credenciales
   → Login funciona
```

---

## Archivos a Modificar/Crear

| Archivo | Acción | Prioridad |
|---------|--------|-----------|
| `prisma/schema.prisma` | Agregar userId a Profesional | 🔴 Alta |
| `prisma/migrations/[ts]_add_user_to_profesional.sql` | Nueva migration | 🔴 Alta |
| `src/data/profesional/profesional.service.ts` | Modificar create() | 🔴 Alta |
| `src/auth/dto/register-professional.dto.ts` | Nuevo DTO | 🟡 Media |
| `src/auth/auth.service.ts` | Agregar método setupProfessionalCredentials | 🟡 Media |
| `src/auth/controllers/admin-management.controller.ts` | Nuevo endpoint | 🟡 Media |
| `src/auth/dto/setup-professional-credentials.dto.ts` | Nuevo DTO | 🟡 Media |

---

## Roles y Permisos

### Profesional (EMPLOYEE)
```
✅ Ver su perfil
✅ Cambiar contraseña
✅ Ver sus citas (Appointments)
✅ Actualizar disponibilidad
❌ Crear otros profesionales
```

### Admin
```
✅ Crear profesional → User automático
✅ Asignar credenciales a profesional existente
✅ Cambiar rol de profesional
✅ Desactivar profesional (y User)
```

---

## Consideraciones de Seguridad

1. **Contraseña Temporal**:
   - Generar contraseña segura (12+ caracteres, mixta)
   - Enviar SOLO UNA VEZ (vía email/SMS)
   - Expirar después de primer login

2. **Email Único**:
   - Campo UNIQUE en UserAuth.email
   - Validar antes de crear

3. **Datos Sensibles**:
   - NO guardar contraseña temporal en logs
   - NO mostrar en respuesta JSON (excepto primera vez)

4. **Auditoría**:
   - Registrar quién asignó credenciales
   - Registrar cambios de email

---

## Roadmap

### Sprint 1 (Esta semana)
- [ ] Crear migration Prisma
- [ ] Modificar ProfesionalService.create()
- [ ] Tests unitarios básicos

### Sprint 2 (Próxima semana)
- [ ] Endpoint para profesionales existentes
- [ ] Tests E2E
- [ ] Documentación API

### Sprint 3
- [ ] Script de migración para datos existentes
- [ ] Envío de credenciales por email/SMS
- [ ] Interfaz en frontend

---

## Nota: Estado actual del teléfono en Profesional

Profesional.phone es UNIQUE, lo que es bueno. Podemos usarlo como identificador alternativo:
```
Login opciones:
1. email + password
2. teléfono + password (convertir a email internamente)
```

Esto daría flexibilidad a los profesionales.
