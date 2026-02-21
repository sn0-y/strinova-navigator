import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { setup } from '@skyra/env-utilities';
import { join } from 'path';

setup({ path: join(process.cwd(), '.env') });

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({
	connectionString,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000
});
const prisma = new PrismaClient({ adapter });

export { prisma };
