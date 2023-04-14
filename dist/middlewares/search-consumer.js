"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchConsumer = exports.SearchConsumer = void 0;
const { ConsumerService } = require("../config/kafka");
const { RegisterClass } = require("../models/plugins/index");
const logger = require("../config/logger");
const { kafka } = require("../config/config");
const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);
class SearchConsumer {
    constructor() {
        this.consumerService = new ConsumerService();
    }
    async consume(topic, groupId) {
        await this.consumerService.consume({
            topic: { topics: [topic] },
            config: { groupId },
            onMessage: async (message) => {
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
exports.SearchConsumer = SearchConsumer;
exports.searchConsumer = new SearchConsumer();
//# sourceMappingURL=search-consumer.js.map