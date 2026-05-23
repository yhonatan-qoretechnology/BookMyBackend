# Checklist: Implementación Step-by-Step

## 📋 FASE 1: PREPARACIÓN (Hoy)
- [ ] Revisar análisis en `ANALISIS_AUTH_PROFESIONAL.md`
- [ ] Revisar plan en `PLAN_IMPLEMENTACION_AUTH_PROFESIONAL.md`
- [ ] Revisar diagrama en `DIAGRAMA_ARQUITECTURA_AUTH.md`
- [ ] Confirmar decisiones con el equipo

## 🔧 FASE 2: CAMBIO DE SCHEMA (1-2 horas)

### 2.1 Modificar Prisma Schema
- [ ] Abrir `prisma/schema.prisma`
- [ ] En modelo `Profesional`, agregar antes de `@@map`:
  ```prisma
  userId        Int?      @unique @map("user_id")
  user          Users?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  ```
- [ ] En modelo `Users`, agregar después de `UserLocation`:
  ```prisma
  profesional   Profesional?
  ```
- [ ] Guardar cambios

### 2.2 Crear Migration
```bash
# Desde la raíz del proyecto
npx prisma migrate dev --name add_user_to_profesional
```

**Verificar**:
- [ ] Archivo creado en `prisma/migrations/[timestamp]_add_user_to_profesional/migration.sql`
- [ ] Base de datos actualizada (Prisma genera automáticamente)
- [ ] Conectar a DB y verificar: `ALTER TABLE profesionales ADD COLUMN user_id INT UNIQUE;`

---

## 🚀 FASE 3: SERVICIOS DE BACKEND (2-3 horas)

### 3.1 Actualizar `ProfesionalService.create()`

**Archivo**: `src/data/profesional/profesional.service.ts`

#### Paso 1: Importar dependencias necesarias
```typescript
// Agregar al constructor o inyectar
// Ya tienes: PrismaService, AccessControlService
// Necesitas verificar: AuthService o HashService disponible

// En el constructor:
constructor(
  private prisma: PrismaService,
  private readonly accessControlService: AccessControlService,
  private readonly sftpStorage: SftpStorageService,
  private readonly configService: ConfigService,
  private readonly hashService: HashService, // ✅ Agregar
  private readonly authService: AuthService,  // ⚠️ O solo HashService
)
```

#### Paso 2: Crear función helper para generar contraseña temporal
```typescript
private generateTemporaryPassword(): string {
  // Generar contraseña segura: 12 caracteres, mixta
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

#### Paso 3: Modificar el método `create()` (línea 112-184)

```typescript
async create(
  createProfesionalDto: CreateProfesionalDto,
  user?: AuthenticatedUser,
  file?: Express.Multer.File,
) {
  // ... VALIDACIONES EXISTENTES (líneas 117-150) - NO CAMBIAR

  let imagenPath: string | undefined;
  try {
    if (file) {
      imagenPath = await this.storeProfesionalImage(file);
    }

    // ========== CREAR PROFESIONAL ==========
    const profesional = await this.prisma.profesional.create({
      data: {
        ...createProfesionalDto,
        imagen: imagenPath,
      },
    });

    // ========== NUEVO: CREAR USER AUTOMÁTICAMENTE ==========
    const tempPassword = this.generateTemporaryPassword();
    const email = createProfesionalDto.phone.replace(/\s+/g, '') + '@bookmyproject.local';

    const createdUser = await this.prisma.users.create({
      data: {
        email: email,
        clientType: ClientType.employee,
        role: Role.EMPLOYEE,
        state: ClientState.enabled,
        UserAuth: {
          create: {
            email: email,
            password: await this.hashService.hash(tempPassword),
          },
        },
        UserData: {
          create: {
            name: createProfesionalDto.nombre,
            phone: createProfesionalDto.phone,
            email: email,
            countryId: 1, // TODO: obtener del contexto o request
            idioma: 'es',
          },
        },
      },
    });

    // ========== VINCULAR PROFESIONAL CON USER ==========
    const linkedProfesional = await this.prisma.profesional.update({
      where: { id: profesional.id },
      data: { userId: createdUser.id },
    });

    return {
      profesional: linkedProfesional,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
      },
      tempPassword, // ⚠️ Mostrar SOLO UNA VEZ
    };

  } catch (error) {
    if (file) {
      await this.safeDeleteRemoteOrLocal(imagenPath || file.path);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          'El número de teléfono ya está en uso.',
        );
      }
    }
    throw error;
  }
}
```

**Verificar**:
- [ ] Sin errores de compilación
- [ ] Imports correctos (ClientType, Role, ClientState de @prisma/client)

### 3.2 Crear DTO nuevo
**Archivo**: `src/auth/dto/setup-professional-credentials.dto.ts` (NUEVO)

```typescript
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class SetupProfessionalCredentialsDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  profesionalId: number;
}
```

**Verificar**:
- [ ] Archivo creado

### 3.3 Crear método en AuthService
**Archivo**: `src/auth/auth.service.ts`

Agregar este método (al final de la clase, antes del cierre):

```typescript
async setupProfessionalCredentials(
  dto: SetupProfessionalCredentialsDto,
) {
  // 1. Verificar que el profesional existe
  const profesional = await this.prisma.profesional.findUnique({
    where: { id: dto.profesionalId },
    include: { user: true },
  });

  if (!profesional) {
    throw new NotFoundException(
      `Profesional con ID ${dto.profesionalId} no encontrado.`,
    );
  }

  // 2. Si ya tiene user: error o actualizar (elegiré actualizar)
  if (profesional.user) {
    // Actualizar email y contraseña
    const hashedPassword = await this.hashService.hash(dto.password);
    
    await this.prisma.userAuth.update({
      where: { user_id: profesional.user.id },
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    await this.prisma.users.update({
      where: { id: profesional.user.id },
      data: { email: dto.email },
    });

    return {
      message: 'Credenciales actualizadas exitosamente.',
      profesionalId: dto.profesionalId,
      email: dto.email,
    };
  }

  // 3. Si NO tiene user: crear nuevo
  const hashedPassword = await this.hashService.hash(dto.password);

  const newUser = await this.prisma.users.create({
    data: {
      email: dto.email,
      clientType: ClientType.employee,
      role: Role.EMPLOYEE,
      state: ClientState.enabled,
      UserAuth: {
        create: {
          email: dto.email,
          password: hashedPassword,
        },
      },
      UserData: {
        create: {
          name: profesional.nombre,
          phone: profesional.phone,
          email: dto.email,
          countryId: 1, // TODO: obtener del país
          idioma: 'es',
        },
      },
    },
  });

  // 4. Vincular
  await this.prisma.profesional.update({
    where: { id: dto.profesionalId },
    data: { userId: newUser.id },
  });

  return {
    message: 'Credenciales creadas exitosamente.',
    profesionalId: dto.profesionalId,
    email: dto.email,
    role: Role.EMPLOYEE,
  };
}
```

**Verificar**:
- [ ] Sin errores de compilación
- [ ] Todos los imports presentes

---

## 📡 FASE 4: ENDPOINTS (1 hora)

### 4.1 Crear endpoint en AdminController
**Archivo**: `src/auth/controllers/admin-management.controller.ts`

Agregar nuevo método:

```typescript
@Patch('profesionales/:id/setup-credentials')
@ApiOperation({ summary: 'Configurar credenciales de un profesional' })
@ApiResponse({ status: 200, description: 'Credenciales configuradas.' })
@ApiBadRequestResponse({ description: 'Datos inválidos.' })
@ApiNotFoundResponse({ description: 'Profesional no encontrado.' })
async setupProfessionalCredentials(
  @Param('id', ParseIntPipe) profesionalId: number,
  @Body() dto: SetupProfessionalCredentialsDto,
  @AuthUser() user?: AuthenticatedUser,
) {
  // TODO: Agregar validación de permisos (solo SUPER_ADMIN o COMPANY_ADMIN)
  if (user && ![Role.SUPER_ADMIN, Role.COMPANY_ADMIN].includes(user.role)) {
    throw new ForbiddenException('No tiene permisos para configurar credenciales.');
  }

  dto.profesionalId = profesionalId;
  return this.authService.setupProfessionalCredentials(dto);
}
```

**Verificar**:
- [ ] Importado DTO nuevo
- [ ] Sin errores de compilación

---

## ✅ FASE 5: TESTING (1-2 horas)

### 5.1 Test Unitario: Crear Profesional
**Archivo**: `src/data/profesional/profesional.service.spec.ts` (Crear o actualizar)

```typescript
describe('ProfesionalService', () => {
  let service: ProfesionalService;

  it('should create professional and automatically create user', async () => {
    const createDto: CreateProfesionalDto = {
      nombre: 'Juan Pérez',
      phone: '+34 600 123 456',
      sedeId: 1,
      biografia: 'Test',
    };

    const result = await service.create(createDto);

    expect(result.profesional).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.tempPassword).toBeDefined();
    expect(result.user.role).toBe(Role.EMPLOYEE);
    expect(result.profesional.userId).toBe(result.user.id);
  });
});
```

**Verificar**:
- [ ] Test corre sin errores
- [ ] Profesional y User se crean juntos

### 5.2 Test E2E: Login con Profesional
```bash
# 1. Crear profesional
POST /profesionales
{
  "nombre": "Carlos López",
  "phone": "+34 700 000 111",
  "sedeId": 1,
  "biografia": ""
}

Response:
{
  "profesional": { "id": 123, ... },
  "user": { "id": 456, "role": "EMPLOYEE" },
  "tempPassword": "aB3#dEfG"
}

# 2. Login con credenciales recibidas
POST /auth/login
{
  "email": "+34700000111@bookmyproject.local",
  "password": "aB3#dEfG"
}

Response:
{
  "access_token": "eyJhbGc...",
  "user": { "id": 456, "role": "EMPLOYEE" }
}

# 3. Acceder a endpoint protegido (como EMPLOYEE)
GET /api/protected
Authorization: Bearer eyJhbGc...

Response: ✅ Autorizado
```

**Verificar**:
- [ ] Login exitoso
- [ ] Token válido
- [ ] Rol EMPLOYEE funcionando

---

## 🗂️ FASE 6: MIGRACIÓN DE DATOS EXISTENTES (2-4 horas)

⚠️ **ESTA FASE ES IMPORTANTE PERO PUEDE HACERSE DESPUÉS**

### 6.1 Crear script de migración (NUEVO)
**Archivo**: `scripts/migrate-existing-profesionales.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de profesionales...');

  // 1. Obtener todos los profesionales sin user
  const profesionalesSinUser = await prisma.profesional.findMany({
    where: { userId: null },
  });

  console.log(`Encontrados ${profesionalesSinUser.length} profesionales sin usuario.`);

  for (const prof of profesionalesSinUser) {
    try {
      const email = prof.phone.replace(/\s+/g, '') + '@bookmyproject.local';
      
      // Crear usuario
      const newUser = await prisma.users.create({
        data: {
          email,
          clientType: 'employee',
          role: 'EMPLOYEE',
          state: 'enabled',
          UserAuth: {
            create: {
              email,
              password: await bcrypt.hash('TempPassword123!', 10),
            },
          },
          UserData: {
            create: {
              name: prof.nombre,
              phone: prof.phone,
              email,
              countryId: 1,
              idioma: 'es',
            },
          },
        },
      });

      // Vincular
      await prisma.profesional.update({
        where: { id: prof.id },
        data: { userId: newUser.id },
      });

      console.log(`✅ Profesional ${prof.id} migrado con éxito.`);
    } catch (error) {
      console.error(`❌ Error migrando profesional ${prof.id}:`, error);
    }
  }

  console.log('✅ Migración completada.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

### 6.2 Ejecutar migración (En producción con cuidado)
```bash
npm run ts-node scripts/migrate-existing-profesionales.ts
```

**Verificar**:
- [ ] Script ejecutado
- [ ] Todos los profesionales tienen usuario
- [ ] Todos tienen role = EMPLOYEE

---

## 📝 FASE 7: DOCUMENTACIÓN (30 min)

- [ ] Documentar endpoints nuevos en Swagger
- [ ] Agregar comentarios en código
- [ ] Actualizar README si es necesario
- [ ] Crear documento de "Cómo onboardear un profesional"

---

## 🚦 CHECKLIST FINAL

### Antes de Merge
- [ ] Todos los tests pasan: `npm test`
- [ ] Linting correcto: `npm run lint`
- [ ] Build exitoso: `npm run build`
- [ ] Revisar cambios en `schema.prisma`
- [ ] Revisar cambios en migrations
- [ ] Código revisado por otro dev

### En Staging
- [ ] Profesionales nuevos pueden iniciar sesión
- [ ] Profesionales antiguos reciben credenciales
- [ ] Login funciona correctamente
- [ ] Cambio de contraseña funciona
- [ ] Role EMPLOYEE restringe acceso correctamente

### En Producción
- [ ] Backup de BD tomado
- [ ] Migration ejecutada
- [ ] Todos los profesionales mirados
- [ ] Envío de credenciales (email/SMS) completado
- [ ] Monitoreo activo por 2 horas

---

## 📞 SOPORTE

Si algo no funciona:
1. Revisar logs: `tail -f logs/app.log`
2. Verificar BD: `SELECT * FROM profesionales WHERE user_id IS NOT NULL;`
3. Verificar JWT decode: https://jwt.io
4. Revisar permisos en `AccessControlService`
