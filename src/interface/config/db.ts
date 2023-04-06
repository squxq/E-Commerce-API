import { Client } from "@elastic/elasticsearch";
import fs from "fs";
import config from "./config";

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

export default elasticClient;
