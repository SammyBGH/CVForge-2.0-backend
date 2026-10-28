import app from './app.js';
import { connectDb } from './config/db.js';
import { env, assertProductionConfig } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  assertProductionConfig();
  try {
    await connectDb();
  } catch (err) {
    if (env.NODE_ENV === 'production') throw err;
    logger.warn(`Startup warning: database connection delayed (${err.message}). API starting regardless.`);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.PORT} is already in use. Either stop the other process or set a different PORT in your .env file.`
      );
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
