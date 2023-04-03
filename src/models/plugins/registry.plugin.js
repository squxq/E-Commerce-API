const { SchemaRegistry, SchemaType } = require("@kafkajs/confluent-schema-registry");
const { kafka } = require("../../config/config");

class RegisterService {
  constructor(host, apiKey, apiSecret) {
    this.registry = new SchemaRegistry({
      host: host,
      auth: {
        username: `${apiKey}`,
        password: `${apiSecret}`,
      },
    });
  }

  async #getSchemaId(schema) {
    const { id } = await this.registry.register({
      type: SchemaType.AVRO,
      schema: JSON.stringify(schema),
    });

    return id;
  }

  async encodePayload(schema, payload) {
    const schemaId = await this.#getSchemaId(schema);

    return await this.registry.encode(schemaId, payload);
  }

  async decodePayload(value) {
    return await this.registry.decode(value);
  }
}

module.exports = new RegisterService(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);
