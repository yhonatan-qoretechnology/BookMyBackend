import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: Role;
  empresaId?: number | null;
  sedeId?: number | null;
}
