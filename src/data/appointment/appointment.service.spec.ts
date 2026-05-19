import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { AppointmentService } from './appointment.service';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let prisma: PrismaService;
  let paymentService: PaymentService;

  const mockPrismaService = {
    profesional: {
      findUnique: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
    },
  };

  const mockPaymentService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfesionalAppointments', () => {
    it('should throw NotFoundException if profesional does not exist', async () => {
      mockPrismaService.profesional.findUnique.mockResolvedValue(null);

      await expect(service.getProfesionalAppointments(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.profesional.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return pending and completed appointments for a professional', async () => {
      const profesionalId = 1;
      const mockProfesional = { id: profesionalId, nombre: 'Dr. Test' };

      const mockPendingAppointment = {
        id: 1,
        serviceId: 1,
        profesionalId,
        sedeId: 1,
        estado: AppointmentStatus.PENDING,
        fecha: new Date('2025-01-20'),
        horaInicio: new Date('2025-01-20T10:00:00Z'),
        horaFin: new Date('2025-01-20T11:00:00Z'),
        service: {
          translations: [
            {
              language: 'es',
              name: 'Consulta',
            },
          ],
        },
        profesional: {
          id: profesionalId,
          nombre: 'Dr. Test',
          phone: '123456789',
          imagen: 'url-imagen',
        },
        sede: {
          id: 1,
          nombre: 'Sede Centro',
          direccion: 'Calle Principal 123',
          telefono: '987654321',
          imagenes: ['url-imagen'],
        },
      };

      mockPrismaService.profesional.findUnique.mockResolvedValue(
        mockProfesional,
      );

      mockPrismaService.appointment.findMany.mockResolvedValueOnce([
        mockPendingAppointment,
      ]);
      mockPrismaService.appointment.findMany.mockResolvedValueOnce([]);

      const result = await service.getProfesionalAppointments(profesionalId);

      expect(result).toHaveProperty('pending');
      expect(result).toHaveProperty('completed');
      expect(result.pending).toHaveLength(1);
      expect(result.completed).toHaveLength(0);
    });

    it('should call findMany twice: once for pending and once for completed', async () => {
      const profesionalId = 1;
      const mockProfesional = { id: profesionalId, nombre: 'Dr. Test' };

      mockPrismaService.profesional.findUnique.mockResolvedValue(
        mockProfesional,
      );
      mockPrismaService.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getProfesionalAppointments(profesionalId);

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledTimes(2);

      // Verify pending query
      expect(mockPrismaService.appointment.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            profesionalId,
            estado: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
          },
        }),
      );

      // Verify completed query
      expect(mockPrismaService.appointment.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            profesionalId,
            estado: AppointmentStatus.COMPLETED,
          },
        }),
      );
    });
  });
});
