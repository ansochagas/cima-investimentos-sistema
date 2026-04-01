import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { rebuildPortfolioLedger } from "./src/utils/calc.js";

const prisma = new PrismaClient();

async function seed() {
  try {
    const adminExists = await prisma.user.findUnique({
      where: { email: "admin@cimainvest.com" },
    });

    if (!adminExists) {
      const hashedAdminPassword = await bcrypt.hash("CimaInvest2024!", 10);
      await prisma.user.create({
        data: {
          email: "admin@cimainvest.com",
          password: hashedAdminPassword,
          role: "ADMIN",
        },
      });
      console.log("Admin criado");
    }

    const clientExists = await prisma.user.findUnique({
      where: { email: "joao@email.com" },
    });

    if (!clientExists) {
      const hashedClientPassword = await bcrypt.hash("123456", 10);
      const user = await prisma.user.create({
        data: {
          email: "joao@email.com",
          password: hashedClientPassword,
          role: "CLIENT",
        },
      });

      await prisma.client.create({
        data: {
          userId: user.id,
          name: "Joao Silva",
          startDate: new Date("2026-03-09T00:00:00.000Z"),
          initialInvestment: 15000,
          currentBalance: 15000,
        },
      });
      console.log("Cliente Joao criado");
    }

    const operationsCount = await prisma.operation.count();
    if (operationsCount === 0) {
      await prisma.operation.createMany({
        data: [
          {
            date: new Date("2026-03-10T18:00:00.000Z"),
            description: "Palmeiras x Corinthians - Vitoria Palmeiras",
            eventName: "Palmeiras x Corinthians",
            market: "Vitoria Palmeiras",
            odds: 1.9,
            stakePct: 2,
            outcome: "WON",
            settledAt: new Date("2026-03-10T21:50:00.000Z"),
            resultPct: 1.8,
            totalCapital: 15000,
            totalStakeAmount: 300,
            pnlAmount: 270,
          },
          {
            date: new Date("2026-03-14T17:30:00.000Z"),
            description: "Flamengo x Gremio - Ambas Marcam",
            eventName: "Flamengo x Gremio",
            market: "Ambas Marcam",
            odds: 1.82,
            stakePct: 1.5,
            outcome: "LOST",
            settledAt: new Date("2026-03-14T20:10:00.000Z"),
            resultPct: -1.5,
            totalCapital: 15270,
            totalStakeAmount: 229.05,
            pnlAmount: -229.05,
          },
          {
            date: new Date("2026-03-20T19:00:00.000Z"),
            description: "Sao Paulo x Santos - Over 2.5",
            eventName: "Sao Paulo x Santos",
            market: "Over 2.5 Gols",
            odds: 2.05,
            stakePct: 1.8,
            outcome: "WON",
            settledAt: new Date("2026-03-20T22:00:00.000Z"),
            resultPct: 1.89,
            totalCapital: 15040.95,
            totalStakeAmount: 270.7371,
            pnlAmount: 284.273955,
          },
        ],
      });
      console.log("Operacoes coletivas de exemplo criadas");
    }

    await rebuildPortfolioLedger(prisma);
    console.log("Seed concluido");
  } catch (error) {
    console.error("Erro no seed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
