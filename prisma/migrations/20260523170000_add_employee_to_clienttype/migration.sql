-- Add the missing enum value for ClientType to match prisma/schema.prisma
ALTER TYPE "public"."ClientType" ADD VALUE IF NOT EXISTS 'employee';
