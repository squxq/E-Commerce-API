const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const mongoose = require("mongoose");
const config = require("./config");
const logger = require("./logger");
const prismaMiddleware = require("../middlewares/prisma");

const prismaInbound = new PrismaClient({
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
prismaInbound.$on("beforeExit", async (e) => {
  logger.warn(`Connection between server and database closed. Event: ${e}`);
});

prismaInbound.$on("query", async (e) => {
  logger.info(`Query: ${e.query}`);
  logger.info(`Params: ${e.params}`);
  logger.info(`Duration: ${e.duration}ms`);
});

prismaInbound.$on("error", async (e) => {
  logger.error(e);
});

prismaInbound.$on("warn", async (e) => {
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

function onSIGINT(db) {
  // eslint-disable-next-line no-undef
  db.close(() => {
    logger.warn("MongoDB Atlas default connection disconnected through app termination!");
    // eslint-disable-next-line no-process-exit
    process.exit();
  });
}

function connectMongo() {
  const connection = mongoose.connect(config.db.mongo.mongoURI, JSON.parse(JSON.stringify(config.db.mongo.options)));
  const db = mongoose.connection;

  db.on("error", (err) => onError(err));
  db.on("connected", onConnected);
  db.on("reconnected", onReconnected);

  process.on("SIGINT", () => onSIGINT(db));
  return connection;
}

// prisma Middleware
prismaInbound.$use(prismaMiddleware);

module.exports = {
  prismaInbound,
  connectMongo,
};
