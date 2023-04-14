const httpStatus = require("http-status");
const retry = require("async-retry");
const logger = require("./logger.js");
const { kafka } = require("./config.js");
const ApiError = require("../utils/ApiError.js");

import { Consumer, Producer, ConsumerConfig, ConsumerSubscribeTopics, Kafka, KafkaMessage, Message } from "kafkajs";

interface IConsumer {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  consume: (onMessage: (message: any) => Promise<void>) => Promise<void>;
}

const sleep = (timeout: number) => {
  return new Promise<void>((resolve) => setTimeout(resolve, timeout));
};

class KafkaJsConsumer implements IConsumer {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;

  constructor(private readonly topic: ConsumerSubscribeTopics, config: ConsumerConfig, broker: string) {
    this.kafka = new Kafka({
      clientId: "E-Commerce-API",
      brokers: [broker],
      ssl: true,
      sasl: {
        mechanism: "plain",
        username: kafka.apiKey,
        password: kafka.apiSecret,
      },
      // connectionTimeout: 1000,
      // requestTimeout: 30000,
    });
    this.consumer = this.kafka.consumer(config);
  }

  async connect() {
    try {
      await this.consumer.connect();
    } catch (err) {
      logger.error("Failed to connect to Kafka.", err);
      await sleep(5000);
      await this.connect();
    }
  }

  async consume(onMessage: (message: KafkaMessage) => Promise<void>) {
    await this.consumer.subscribe(this.topic);
    await this.consumer.run({
      eachMessage: async ({ message, partition }) => {
        logger.debug(`Processing message partition: ${partition}`);
        try {
          await retry(async () => onMessage(message), {
            retries: 3,
            onRetry: (error: any, attempt: any) =>
              logger.error(`Error consuming message, executing retry${attempt}/3.`, error),
          });
        } catch (err) {
          throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Error consuming message. ${err}`, false);
        }
      },
    });
  }

  async disconnect() {
    await this.consumer.disconnect();
  }
}

interface KafkaJsConsumerOptions {
  topic: ConsumerSubscribeTopics;
  config: ConsumerConfig;
  onMessage: (message: KafkaMessage) => Promise<void>;
}

export class ConsumerService {
  private readonly consumers: IConsumer[] = [];

  async consume({ topic, config, onMessage }: KafkaJsConsumerOptions) {
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

interface IProducer {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  produce: (message: any) => Promise<void>;
}

class KafkaJsProducer implements IProducer {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(private readonly topic: string, broker: string) {
    this.kafka = new Kafka({
      clientId: "E-Commerce-API",
      brokers: [broker],
      ssl: true,
      sasl: {
        mechanism: "plain",
        username: kafka.apiKey,
        password: kafka.apiSecret,
      },
      // connectionTimeout: 1000,
      // requestTimeout: 30000,
    });
    this.producer = this.kafka.producer();
  }

  async produce(message: Message) {
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

export class ProducerService {
  private readonly producers = new Map<string, IProducer>();

  async produce(topic: string, message: Message) {
    const producer = await this.getProducer(topic);

    await producer.produce(message);
  }

  private async getProducer(topic: string) {
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
