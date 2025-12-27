import { startBot } from "./bot.js";
import { AppDataSource } from "./database/dataSource.js";
import { seedDatabase } from "./services/seedService.js";

async function bootstrap() {
  try {
    console.log("🚀 Inicializando sistema Multi-tenant...");

    // 1. Conectar ao Banco
    await AppDataSource.initialize();
    console.log("📦 Banco de dados conectado.");

    // 2. Rodar Seeds (Criar Tenant/Queue/Instance se não existir)
    const whatsappInstance = await seedDatabase();

    // 3. Iniciar o Bot para a instância recuperada
    // Se estiver desconectado, ele gerará o QR Code no terminal dentro do startBot
    await startBot(whatsappInstance);
  } catch (error) {
    console.error("Erro fatal:", error);
  }
}

bootstrap();
