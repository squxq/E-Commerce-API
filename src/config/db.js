const { PrismaClient } = require("@prisma/client");
const logger = require("./logger");
const prismaMiddleware = require("../middlewares/prisma");

const prisma = new PrismaClient({
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
prisma.$on("beforeExit", async (e) => {
  logger.warn(`Connection between server and database closed. Event: ${e}`);
});

prisma.$on("query", async (e) => {
  logger.info(`Query: ${e.query}`);
  logger.info(`Params: ${e.params}`);
  logger.info(`Duration: ${e.duration}ms`);
});

prisma.$on("error", async (e) => {
  logger.error(e);
});

prisma.$on("warn", async (e) => {
  logger.warn(e);
});

// prisma Middleware
prisma.$use(prismaMiddleware);

module.exports = prisma;
