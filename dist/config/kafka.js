"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProducerService = exports.ConsumerService = void 0;
const httpStatus = require("http-status");
const retry = require("async-retry");
const logger = require("./logger.js");
const { kafka } = require("./config.js");
const ApiError = require("../utils/ApiError.js");
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
                username: kafka.apiKey,
                password: kafka.apiSecret,
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
                    await retry(async () => onMessage(message), {
                        retries: 3,
                        onRetry: (error, attempt) => logger.error(`Error consuming message, executing retry${attempt}/3.`, error),
                    });
                }
                catch (err) {
                    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Error consuming message. ${err}`, false);
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
        const consumer = new KafkaJsConsumer(topic, config, kafka.bootstrapURL);
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
                username: kafka.apiKey,
                password: kafka.apiSecret,
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
            producer = new KafkaJsProducer(topic, kafka.bootstrapURL);
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