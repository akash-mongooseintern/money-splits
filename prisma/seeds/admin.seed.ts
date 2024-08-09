import { Prisma } from '@prisma/client';

export const admin: Prisma.AdminCreateInput = {
  firstname: 'fname',
  lastname: 'lname',
  email: process.env.ADMIN_EMAIL || '',
  meta: {
    create: {
      passwordSalt: process.env.ADMIN_PASSWORD_SALT || '',
      passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    },
  },
};
