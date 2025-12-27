import { startBot } from "./bot.js";
import { AppDataSource } from "./database/dataSource.js";
import { AuthSession } from "./database/entities/AuthSession.entity.js";
import { usePostgresAuthState } from "./services/authService.js";

async function bootstrap() {
  try {
    // 1. Iniciar Banco de Dados
    console.log("Inicializando banco de dados...");
    await AppDataSource.initialize();
    console.log("📦 Banco conectado com sucesso.");

    // 2. Preparar Repositório e Serviço de Auth
    const authRepository = AppDataSource.getRepository(AuthSession);

    // Aqui definimos o nome da sessão. Isso permite rodar múltiplos bots mudando apenas essa string.
    const sessionId = "bot-principal";

    const authState = await usePostgresAuthState(authRepository, sessionId);

    // 3. Iniciar o Bot
    console.log("Iniciando o Bot...");
    await startBot(authState);
  } catch (error) {
    console.error("Erro fatal ao iniciar a aplicação:", error);
  }
}

bootstrap();
