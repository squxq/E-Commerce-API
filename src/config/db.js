const { PrismaClient } = require("@prisma/client");
const mongoose = require("mongoose");
const config = require("./config");
const logger = require("./logger");
const prismaMiddleware = require("../middlewares/prisma");

const prismaProducts = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "stdout",
      level: "error",
    },
    {
      emit: "stdout",
      level: "info",
    },
    {
      emit: "stdout",
      level: "warn",
    },
  ],
  errorFormat: "colorless",
});

// Logs
prismaProducts.$on("beforeExit", async (e) => {
  logger.warn(`Connection between server and database closed. Event: ${e}`);
});

prismaProducts.$on("query", async (e) => {
  logger.info(`Query: ${e.query}`);
  logger.info(`Params: ${e.params}`);
  logger.info(`Duration: ${e.duration}ms`);
});

prismaProducts.$on("error", async (e) => {
  logger.error(e);
});

prismaProducts.$on("warn", async (e) => {
  logger.warn(e);
});

mongoose.set("strictQuery", false);

mongoose.Promise = global.Promise;

function onError(err) {
  logger.error(`MongoDB Atlas connection error: ${err}`);
}

function onConnected() {
  logger.log("debug", "Connected to MongoDB Atlas!");
}

function onReconnected() {
  logger.warn("MongoDB Atlas reconnected!");
}

function onSIGINT() {
  // eslint-disable-next-line no-undef
  db.close(() => {
    logger.warn("MongoDB Atlas default connection disconnected through app termination!");
    // eslint-disable-next-line no-process-exit
    process.exit();
  });
}

function connectMongo() {
  const connection = mongoose.connect(config.db.mongo.mongoURI, config.db.mongo.options);
  const db = mongoose.connection;

  db.on("error", onError);
  db.on("connected", onConnected);
  db.on("reconnected", onReconnected);

  process.on("SIGINT", onSIGINT);
  return connection;
}

// prisma Middleware
prismaProducts.$use(prismaMiddleware);

module.exports = {
  prismaProducts,
  connectMongo,
};
