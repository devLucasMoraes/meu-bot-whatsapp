import { AppDataSource } from "../database/dataSource.js";
import { Queue } from "../database/entities/Queue.entity.js";
import { Tenant } from "../database/entities/Tenant.entity.js";
import { User } from "../database/entities/User.entity.js";
import { WhatsappInstance } from "../database/entities/WhatsappInstance.entity.js";

export async function seedDatabase() {
  const tenantRepo = AppDataSource.getRepository(Tenant);
  const userRepo = AppDataSource.getRepository(User);
  const queueRepo = AppDataSource.getRepository(Queue);
  const whatsappRepo = AppDataSource.getRepository(WhatsappInstance);

  // 1. Verificar se já existe Tenant
  let tenant = await tenantRepo.findOneBy({ documentNumber: "12345678000199" });

  if (!tenant) {
    console.log("🌱 Criando dados iniciais (Seed)...");

    // Criar Tenant
    tenant = tenantRepo.create({
      name: "Empresa Demo SaaS",
      documentNumber: "12345678000199",
      status: "active",
    });
    await tenantRepo.save(tenant);

    // Criar Filas
    const queueSales = queueRepo.create({
      name: "Comercial",
      color: "#0000FF",
      greetingMessage:
        "Você escolheu o Comercial. Um vendedor logo vai te atender.",
      tenant,
    });

    const queueSupport = queueRepo.create({
      name: "Suporte",
      color: "#FF0000",
      greetingMessage: "Você escolheu o Suporte. Aguarde um técnico.",
      tenant,
    });

    await queueRepo.save([queueSales, queueSupport]);

    // Criar Usuário Admin
    const admin = userRepo.create({
      name: "Administrador",
      email: "admin@saas.com",
      passwordHash: "senha_super_secreta", // Em produção, use bcrypt
      role: "admin",
      tenant,
      queues: [queueSales, queueSupport],
    });
    await userRepo.save(admin);

    // Criar Instância do WhatsApp
    const whatsapp = whatsappRepo.create({
      name: "Conexão Principal",
      status: "DISCONNECTED",
      isDefault: true,
      tenant,
    });
    await whatsappRepo.save(whatsapp);

    console.log("✅ Seed concluído com sucesso!");
    return whatsapp;
  } else {
    console.log("ℹ️ Dados já existem. Buscando instância padrão...");
    return await whatsappRepo.findOneByOrFail({
      tenantId: tenant.id,
      isDefault: true,
    });
  }
}
