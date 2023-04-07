/* eslint-disable max-classes-per-file */
const kafkajs = require("kafkajs");
const logger = require("./logger");
const { kafka } = require("./config");

const sleep = (timeout) => {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, timeout));
};

class KafkaJsProducer {
  constructor(topic, broker) {
    this.topic = topic;
    this.kafka = new kafkajs.Kafka({
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
    } catch (err) {
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
  constructor() {
    this.producers = new Map();
  }

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
    const producerPromises = this.producers.values().map((producer) => producer.disconnect());
    await Promise.all(producerPromises);
  }
}

module.exports = {
  ProducerService,
};
