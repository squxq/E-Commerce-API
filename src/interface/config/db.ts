import mongoose, { ConnectOptions } from "mongoose";
import { Client } from "@elastic/elasticsearch";
import fs from "fs";
import { config, logger } from ".";

const elasticClient = new Client({
  node: config.elastic.elasticSearchURI,
  auth: {
    username: config.elastic.elasticSearchUsername,
    password: config.elastic.elasticSearchPassword,
  },
  tls: {
    ca: fs.readFileSync("../../http_ca.crt"),
    rejectUnauthorized: false,
  },
});

mongoose.set("strictQuery", false);
mongoose.Promise = global.Promise;

function onError(err: object) {
  logger.error(`MongoDB Atlas connection error: ${err}`);
}

function onConnected() {
  logger.log("debug", "Connected to MongoDB Atlas!");
}

function onReconnected() {
  logger.warn("MongoDB Atlas reconnected!");
}

function onSIGINT(db: any) {
  // eslint-disable-next-line no-undef
  db.close(() => {
    logger.warn("MongoDB Atlas default connection disconnected through app termination!");
    // eslint-disable-next-line no-process-exit
    process.exit();
  });
}

const options: ConnectOptions = JSON.parse(JSON.stringify(config.db.mongo.options));

function connectMongo() {
  const connection = mongoose.connect(config.db.mongo.mongoURI, options);
  const db = mongoose.connection;

  db.on("error", (err) => onError(err));
  db.on("connected", onConnected);
  db.on("reconnected", onReconnected);

  process.on("SIGINT", () => onSIGINT(db));
  return connection;
}

export { elasticClient, connectMongo };
