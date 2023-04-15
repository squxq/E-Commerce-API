import { ConsumerService } from "../config/kafka";
import { RegisterClass } from "../models/plugins/index";
import * as logger from "../config/logger";
import { kafka } from "../config/config";
import { elasticClient } from "../config/db";

const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);

export class SearchConsumer {
  private readonly consumerService: ConsumerService;
  private lookupMap: {
    [key: string]: (id: string, decodedValue: object) => void;
  };

  constructor() {
    this.consumerService = new ConsumerService();

    this.lookupMap = {
      CREATE_PRODUCT: this.createProducts,
      CREATE_ITEM: this.createProductItems,
      UPDATE_PRODUCT: this.updateProducts,
      // UPDATE_ITEM: function4,
      // DELETE_PRODUCT: function5,
      // DELETE_ITEM: function6,
    };
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

        // key === { id, action, content } and value === the rest of the object
        // check first for action and the for content

        // await action(decodedKey, decodedValue, topic);
        const consumeFunction = this.lookupMap[`${decodedKey.action}_${decodedKey.content}`];

        consumeFunction && consumeFunction(decodedKey.id, decodedValue);
      },
    });

    logger.debug(`Connected to '${topic}' topic!`);
  }

  private async createProducts(id: string, decodedValue: { variants?: object }) {
    const variants = decodedValue.variants;
    delete decodedValue.variants;

    const doc: object = {
      ...decodedValue,
      variants: [variants],
    };

    await elasticClient.index({
      index: "products",
      id,
      document: doc,
    });
  }

  private async createProductItems(id: string, decodedValue: { variants?: object }) {
    await elasticClient.update({
      index: "products",
      id,
      script: {
        source: "ctx._source.variants.add(params.newVariant)",
        params: {
          newVariant: decodedValue.variants,
        },
      },
    });
  }

  private async updateProducts(id: string, decodedValue: object) {
    await elasticClient.update({
      index: "products",
      id,
      doc: decodedValue,
    });
  }
  private async updateProductItems(id: string, decodedValue: object) {
    // await
  }

  async consumeTopics() {
    await this.consume("Products", "ProductConsumer");
  }
}

export const searchConsumer = new SearchConsumer();
