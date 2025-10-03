import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seed() {
  try {
    // Criar usuário admin se não existir
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
      console.log("✅ Admin criado");
    }

    // Criar cliente de teste
    const clientExists = await prisma.user.findUnique({
      where: { email: "fabricio@teste.com" },
    });
    if (!clientExists) {
      const hashedClientPassword = await bcrypt.hash("123456", 10);
      const user = await prisma.user.create({
        data: {
          email: "fabricio@teste.com",
          password: hashedClientPassword,
          role: "CLIENT",
        },
      });

      await prisma.client.create({
        data: {
          userId: user.id,
          name: "Fabrício Silva",
          startDate: new Date(),
          initialInvestment: 25000.0,
          currentBalance: 25000.0,
        },
      });
      console.log("✅ Cliente Fabrício criado");
    }

    console.log("🎉 Seed concluído!");
  } catch (error) {
    console.error("❌ Erro no seed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
