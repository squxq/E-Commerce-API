const { ConsumerService } = require("../config/kafka.ts");
const { RegisterClass } = require("../models/plugins/index");
const logger = require("../config/logger");
const { kafka } = require("../config/config");

const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);
const consumerService = new ConsumerService();

class SearchConsumer {
  private readonly consumerService: typeof ConsumerService;
  constructor() {
    this.consumerService = consumerService;
  }

  async consume(topic: string) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId: "ProductConsumer" },
      onMessage: async (message: { key; value }) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        logger.debug(decodedKey);
        logger.debug(decodedValue);
      },
    });
  }

  async consumeSearch() {
    await this.consume("Products");
    // await this.consume("ProductItems");
  }
}

const searchConsumer = new SearchConsumer();
searchConsumer.consumeSearch();
