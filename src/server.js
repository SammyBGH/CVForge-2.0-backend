import app from './app.js';
import { connectDb } from './config/db.js';
import { env, assertProductionConfig } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  assertProductionConfig();
  await connectDb();
  app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
