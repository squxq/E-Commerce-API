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
      UPDATE_ITEM: this.updateProductItems,
      DELETE_PRODUCT: this.deleteProducts,
      DELETE_ITEM: this.deleteProductItems,
    };
  }

  private async consume(topic: string, groupId: string) {
    await this.consumerService.consume({
      topic: { topics: [topic] },
      config: { groupId },
      onMessage: async (message: { key: any; value: any }) => {
        const decodedKey = await register.decodePayload(message.key);
        const decodedValue = await register.decodePayload(message.value);
        decodedKey && logger.debug(decodedKey);
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

  private async updateProducts(id: string, decodedValue: { changes?: object }) {
    await elasticClient.update({
      index: "products",
      id,
      doc: decodedValue.changes,
    });
  }

  private async updateProductItems(id: string, decodedValue: { changes?: { id?: string } }) {
    const itemId = decodedValue?.changes?.id;
    delete decodedValue?.changes?.id;

    await elasticClient.update({
      index: "products",
      id,
      script: {
        source: `
          for (def i = 0; i < ctx._source.variants.length; i++) {
            if (ctx._source.variants[i].id == params.itemId) {
              def updatedProperties = params.updatedProperties.entrySet();
              for (def entry : updatedProperties) {
                ctx._source.variants[i][entry.getKey()] = entry.getValue();
              }
            }
          }
        `,
        params: {
          itemId,
          updatedProperties: decodedValue.changes,
        },
      },
    });
  }

  private async deleteProducts(id: string) {
    await elasticClient.delete({
      index: "products",
      id,
    });
  }

  private async deleteProductItems(id: string, decodedValue: { id?: string }) {
    await elasticClient.update({
      index: "products",
      id,
      script: {
        source: `
          for (int i = ctx._source.variants.length-1; i >= 0; i--) {
            if (ctx._source.variants[i].id == params.itemId) {
              ctx._source.variants.remove(i);
            }
          }
        `,
        params: {
          itemId: decodedValue.id,
        },
      },
    });
  }

  async consumeTopics() {
    await this.consume("Products", "ProductConsumer");
  }
}

export const searchConsumer = new SearchConsumer();
