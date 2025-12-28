import createApp from "./app.js";
import { env } from "./config/env.js";
import registerRoutes from "./routes/index.js";

async function init() {
  const app = await createApp();
  await registerRoutes(app);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });

    app.log.info(`🚀 Server running at http://localhost:${env.PORT}`);
    app.log.info(`📚 Documentation at http://localhost:${env.PORT}/docs`);

    //if (env.NODE_ENV === "development") await seedDatabase();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

init();
