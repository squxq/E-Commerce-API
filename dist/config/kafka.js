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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProducerService = exports.ConsumerService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const async_retry_1 = __importDefault(require("async-retry"));
const logger = __importStar(require("./logger.js"));
const config_js_1 = require("./config.js");
const ApiError_js_1 = __importDefault(require("../utils/ApiError.js"));
const kafkajs_1 = require("kafkajs");
const sleep = (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};
class KafkaJsConsumer {
    topic;
    kafka;
    consumer;
    constructor(topic, config, broker) {
        this.topic = topic;
        this.kafka = new kafkajs_1.Kafka({
            clientId: "E-Commerce-API",
            brokers: [broker],
            ssl: true,
            sasl: {
                mechanism: "plain",
                username: config_js_1.kafka.apiKey,
                password: config_js_1.kafka.apiSecret,
            },
            connectionTimeout: 1000,
            requestTimeout: 30000,
        });
        this.consumer = this.kafka.consumer(config);
    }
    async connect() {
        try {
            await this.consumer.connect();
        }
        catch (err) {
            logger.error("Failed to connect to Kafka.", err);
            await sleep(5000);
            await this.connect();
        }
    }
    async consume(onMessage) {
        await this.consumer.subscribe(this.topic);
        await this.consumer.run({
            eachMessage: async ({ message, partition }) => {
                logger.debug(`Processing message partition: ${partition}`);
                try {
                    await (0, async_retry_1.default)(async () => onMessage(message), {
                        retries: 3,
                        onRetry: (error, attempt) => logger.error(`Error consuming message, executing retry${attempt}/3.`, error),
                    });
                }
                catch (err) {
                    throw new ApiError_js_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Error consuming message. ${err}`, false);
                }
            },
        });
    }
    async disconnect() {
        await this.consumer.disconnect();
    }
}
class ConsumerService {
    consumers = [];
    async consume({ topic, config, onMessage }) {
        const consumer = new KafkaJsConsumer(topic, config, config_js_1.kafka.bootstrapURL);
        await consumer.connect();
        await consumer.consume(onMessage);
        this.consumers.push(consumer);
    }
    async disconnect() {
        for (const consumer of this.consumers) {
            await consumer.disconnect();
        }
    }
}
exports.ConsumerService = ConsumerService;
class KafkaJsProducer {
    topic;
    kafka;
    producer;
    constructor(topic, broker) {
        this.topic = topic;
        this.kafka = new kafkajs_1.Kafka({
            clientId: "E-Commerce-API",
            brokers: [broker],
            ssl: true,
            sasl: {
                mechanism: "plain",
                username: config_js_1.kafka.apiKey,
                password: config_js_1.kafka.apiSecret,
            },
            connectionTimeout: 1000,
            requestTimeout: 30000,
        });
        this.producer = this.kafka.producer();
    }
    async produce(message) {
        await this.producer.send({ topic: this.topic, messages: [message] });
    }
    async connect() {
        try {
            await this.producer.connect();
        }
        catch (err) {
            logger.error("Failed to connect to Kafka.", err);
            await sleep(5000);
            await this.connect();
        }
    }
    async disconnect() {
        await this.producer.disconnect();
    }
}
class ProducerService {
    producers = new Map();
    async produce(topic, message) {
        const producer = await this.getProducer(topic);
        await producer.produce(message);
    }
    async getProducer(topic) {
        let producer = this.producers.get(topic);
        if (!producer) {
            producer = new KafkaJsProducer(topic, config_js_1.kafka.bootstrapURL);
            await producer.connect();
            this.producers.set(topic, producer);
        }
        return producer;
    }
    async disconnect() {
        for (const producer of this.producers.values()) {
            await producer.disconnect();
        }
    }
}
exports.ProducerService = ProducerService;
//# sourceMappingURL=kafka.js.map