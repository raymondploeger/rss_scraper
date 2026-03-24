import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

let prisma;

export async function connectDatabase() {
  if (!env.databaseUrl) {
    throw new Error(
      "Missing DATABASE_URL. Create backend/.env file or set DATABASE_URL in Railway service variables."
    );
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  await prisma.$connect();
  console.log("PostgreSQL connected through Prisma");
  return prisma;
}

export function getDatabase() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}
