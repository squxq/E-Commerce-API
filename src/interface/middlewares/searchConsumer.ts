import { RegisterClass } from "../models/plugins";
import { config, logger } from "../config";
import { ConsumerService } from "../config";
import { elasticClient } from "../config";

const register = new RegisterClass(config.kafka.schemaHost, config.kafka.schemaKey, config.kafka.schemaSecret);
const consumerService = new ConsumerService();

export class SearchConsumer {
  private readonly consumerService: ConsumerService;
  constructor() {
    this.consumerService = consumerService;
  }

  async consume(topic: string, groupId: string) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId: groupId },
      onMessage: async (message: { key: any; value: any }) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        logger.debug(decodedKey);
        logger.debug(decodedValue);

        // direct the info to elasticsearch
      },
    });
  }

  async consumeTopics() {
    await this.consume("Products", "ProductConsumer");
    // await this.consume("ProductItems");
  }
}
