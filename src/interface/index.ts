import mongoose from "mongoose";
import app from "./app";
import config from "./config/config";
import logger from "./config/logger";

let server: any;
mongoose.connect(config.db.mongo.mongoURI).then(() => {
  logger.debug("Connected to MongoDB");
  server = app.listen(config.interfacePort, () => {
    logger.info(`
        ################################################
        🚀 Interface Service listening on port: ${config.interfacePort} 🚀
        ################################################
    `);
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
