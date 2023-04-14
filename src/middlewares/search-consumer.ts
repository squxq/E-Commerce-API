const { ConsumerService } = require("../config/kafka");
const { RegisterClass } = require("../models/plugins/index");
const logger = require("../config/logger");
const { kafka } = require("../config/config");

const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);

export class SearchConsumer {
  private readonly consumerService: typeof ConsumerService;
  constructor() {
    this.consumerService = new ConsumerService();
  }

  private async consume(topic: string, groupId: string) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId },
      onMessage: async (message: { key: any; value: any }) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        logger.debug(decodedKey);
        logger.debug(decodedValue);

        // direct the info to elasticsaerch
      },
    });

    logger.debug(`Connected to '${topic}' topic!`);
  }

  async consumeTopics() {
    await this.consume("Products", "ProductConsumer");
    // await this.consume("ProductItems");
  }
}

export const searchConsumer = new SearchConsumer();
