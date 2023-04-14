"use strict";
const app = require("./app");
const config = require("./config/config");
const logger = require("./config/logger");
const { prismaInbound, connectMongo, elasticClient } = require("./config/db");
const { searchConsumer } = require("./middlewares/search-consumer");
// Express usual app.listen()
let server;
connectMongo().then(() => {
    prismaInbound.$connect().then(() => {
        searchConsumer.consumeTopics().then(() => {
            elasticClient.connect().then(() => {
                server = app.listen(config.port, () => {
                    logger.info(`
              ##############################################
              🚀 Server listening on port: ${config.port} 🚀
              ##############################################
          `);
                });
            });
        });
    });
});
const exithandler = () => {
    if (server) {
        server.close(() => {
            logger.info("Server closed");
            process.exit(1);
        });
    }
    else {
        process.exit(1);
    }
};
// Error found --> Server closes
const unexpectedErrorHandler = (error) => {
    logger.error(error);
    exithandler();
};
// listens for uncaught exceptions and unhandled rejections
process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledException", unexpectedErrorHandler);
process.on("SIGTERM", () => {
    logger.info("SIGTERM received");
    if (server) {
        server.close();
    }
});
// When a signal handler is added (process.once('SIGTERM'), the handler code is scheduled for the next event loop. So behaviour immediately changes even if you just call process.exit() in the handler.
// Promises, or Javascript generally for that matter, don't have the concept of cancellation built in yet. You could track promises but unless the underlying API's being used specifically address ways to cancel tasks then there's not much to do.
//# sourceMappingURL=index.js.map