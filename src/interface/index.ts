import app from "./app";
import { config, logger, connectMongo } from "./config";
import { SearchConsumer } from "./middlewares";

const searchConsumer = new SearchConsumer();

let server: any;
connectMongo().then(() => {
  logger.debug("Connected to MongoDB");
  searchConsumer.consumeTopics().then(() => {
    logger.debug("Connected to Kafka Topics");
    server = app.listen(config.interfacePort, () => {
      logger.info(`
          ################################################
          🚀 Interface Service listening on port: ${config.interfacePort} 🚀
          ################################################
      `);
    });
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: string) => {
  logger.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});
