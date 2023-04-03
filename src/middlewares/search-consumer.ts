import { ConsumerService } from "../config/kafka";
import { RegisterClass } from "../models/plugins/index.js";
import * as logger from "../config/logger.js";

export class SearchConsumer {
  constructor(private readonly consumerService: ConsumerService) {}

  async consume(topic: string) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId: "ProductConsumer" },
      onMessage: async (message) => {
        const decodedValue = await RegisterClass.decodePayload(message.value);
        logger.debug(`Topic: ${topic}; Message: ${decodedValue}.`);
      },
    });
  }
}
