const { ConsumerService } = require("../config/kafka");
const { RegisterClass } = require("../models/plugins/index.js");
const logger = require("../config/logger.js");
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
      onMessage: async (message) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        logger.debug(decodedKey, decodedValue);
      },
    });
  }

  async consumeSearch() {
    await this.consume("Products");
  }
}

const searchConsumer = new SearchConsumer();
searchConsumer.consumeSearch();
