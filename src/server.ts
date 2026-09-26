import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/connect';
import { tokenStore } from './shared/auth/tokenStore';

async function main(): Promise<void> {
  await connectDatabase();
  const app = createApp();

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`order-payment-api listening on port ${config.port} (${config.env})`);
  });

  // Release network handles so the process can shut down cleanly.
  const shutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.log(`${signal} received, closing server`);
    server.close(async () => {
      await tokenStore.close();
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('failed to start server', err);
  process.exit(1);
});
