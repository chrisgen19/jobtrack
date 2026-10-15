// Truncates application tables in the E2E database (run by global setup).
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../../tests/support/db";

await resetDatabase();
await prisma.$disconnect();
