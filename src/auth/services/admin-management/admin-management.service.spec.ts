import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminManagementService } from './admin-management.service';

const createPrismaMock = () => ({
  empresa: {
    findUnique: jest.fn(),
  },
  sede: {
    findUnique: jest.fn(),
  },
  users: {
    create: jest.fn(),
  },
});

describe('AdminManagementService', () => {
  const hashServiceMock = {
    hash: jest.fn().mockResolvedValue('hashed-password'),
  };
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let service: AdminManagementService;

  beforeEach(() => {
    prismaMock = createPrismaMock();
    service = new AdminManagementService(
      prismaMock as any,
      hashServiceMock as any,
    );
    jest.clearAllMocks();
  });

  describe('createCompanyAdmin', () => {
    it('debería lanzar NotFoundException si la empresa no existe', async () => {
      prismaMock.empresa.findUnique.mockResolvedValue(null);

      await expect(
        service.createCompanyAdmin(1, {
          email: 'admin@corp.com',
          password: 'Admin123$',
          phone: '+123456789',
          firstName: 'John',
          lastName: 'Doe',
          countryId: 1,
          role: Role.COMPANY_ADMIN,
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('debería crear un COMPANY_ADMIN cuando la empresa existe', async () => {
      prismaMock.empresa.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.users.create.mockResolvedValue({ id: 99 });

      await service.createCompanyAdmin(1, {
        email: 'admin@corp.com',
        password: 'Admin123$',
        phone: '+123456789',
        firstName: 'John',
        lastName: 'Doe',
        countryId: 1,
        role: Role.COMPANY_ADMIN,
      } as any);

      expect(prismaMock.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.COMPANY_ADMIN,
          }),
        }),
      );
    });
  });

  describe('createBranchAdmin', () => {
    it('debería lanzar NotFoundException si la sede no existe', async () => {
      prismaMock.sede.findUnique.mockResolvedValue(null);

      await expect(
        service.createBranchAdmin(
          10,
          {
            email: 'branch@corp.com',
            password: 'Branch123$',
            phone: '+123456789',
            firstName: 'Jane',
            lastName: 'Doe',
            countryId: 1,
            role: Role.BRANCH_ADMIN,
          } as any,
          { userId: 1, role: Role.SUPER_ADMIN } as any,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('debería lanzar BadRequestException si la sede no pertenece a la empresa indicada', async () => {
      prismaMock.sede.findUnique.mockResolvedValue({ id: 2, empresaId: 5 });

      await expect(
        service.createBranchAdmin(
          2,
          {
            email: 'branch@corp.com',
            password: 'Branch123$',
            phone: '+123456789',
            firstName: 'Jane',
            lastName: 'Doe',
            countryId: 1,
            role: Role.BRANCH_ADMIN,
            empresaId: 99,
          } as any,
          { userId: 1, role: Role.SUPER_ADMIN } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('debería crear un BRANCH_ADMIN cuando la sede es válida', async () => {
      prismaMock.sede.findUnique.mockResolvedValue({ id: 2, empresaId: 5 });
      prismaMock.users.create.mockResolvedValue({ id: 100 });

      await service.createBranchAdmin(
        2,
        {
          email: 'branch@corp.com',
          password: 'Branch123$',
          phone: '+123456789',
          firstName: 'Jane',
          lastName: 'Doe',
          countryId: 1,
          role: Role.BRANCH_ADMIN,
        } as any,
        { userId: 1, role: Role.SUPER_ADMIN } as any,
      );

      expect(prismaMock.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.BRANCH_ADMIN,
            AdminProfile: expect.objectContaining({
              create: expect.objectContaining({
                sedeId: 2,
                empresaId: 5,
              }),
            }),
          }),
        }),
      );
    });
  });
});
