import { elasticClient } from "../../config/db";
import { Client } from "@elastic/elasticsearch";
import logger = require("../../config/logger");

export class ElasticSearchMap {
  private client: Client;

  constructor() {
    this.client = elasticClient;
  }

  async createMap(index: string, mapping: { properties: object }) {
    await this.client.indices.putMapping({
      index,
      ...mapping,
    });

    logger.debug(`Mapping added to index ${index}`);
  }
}
