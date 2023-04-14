import { ConsumerService } from "../config/kafka";
import { RegisterClass } from "../models/plugins/index";
import * as logger from "../config/logger";
import { kafka } from "../config/config";
import { elasticClient } from "../config/db";

const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);

export class SearchConsumer {
  private readonly consumerService: ConsumerService;
  constructor() {
    this.consumerService = new ConsumerService();
  }

  private async consume(topic: string, groupId: string, action: any) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId },
      onMessage: async (message: { key: any; value: any }) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        logger.debug(decodedKey);
        logger.debug(decodedValue);

        // key === id and value === the rest of the object
        await action(decodedKey, decodedValue, topic);
      },
    });

    logger.debug(`Connected to '${topic}' topic!`);
  }

  private async consumeProducts(decodedKey: { id: string }, decodedValue: { variants?: object }, topic: string) {
    const variants = decodedValue.variants;
    delete decodedValue.variants;

    const doc: object = {
      ...decodedValue,
      variants: [variants],
    };

    await elasticClient.index({
      index: topic.toLowerCase(),
      id: decodedKey.id,
      document: doc,
    });
  }

  private async consumeProductItems(decodedKey: { id: string }, decodedValue: { variants?: object }, _topic: string) {
    await elasticClient.update({
      index: "products",
      id: decodedKey.id,
      body: {
        script: {
          source: "ctx._source.variants.add(params.newVariant)",
          params: {
            newVariant: decodedValue.variants,
          },
        },
      },
    });
  }

  async consumeTopics() {
    await this.consume("Products", "ProductConsumer", this.consumeProducts);
    await this.consume("ProductItems", "ProductItemConsumer", this.consumeProductItems);
  }
}

export const searchConsumer = new SearchConsumer();
