"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchConsumer = void 0;
const index_js_1 = require("../models/plugins/index.js");
const logger = __importStar(require("../config/logger.js"));
class SearchConsumer {
    consumerService;
    constructor(consumerService) {
        this.consumerService = consumerService;
    }
    async consume(topic) {
        await this.consumerService.consume({
            topic: { topics: [topic] },
            config: { groupId: "ProductConsumer" },
            onMessage: async (message) => {
                const decodedValue = await index_js_1.RegisterClass.decodePayload(message.value);
                logger.debug(`Topic: ${topic}; Message: ${decodedValue}.`);
            },
        });
    }
}
exports.SearchConsumer = SearchConsumer;
//# sourceMappingURL=search-consumer.js.map