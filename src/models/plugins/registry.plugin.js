const { SchemaRegistry, SchemaType } = require("@kafkajs/confluent-schema-registry");

class RegisterService {
  constructor(host, apiKey, apiSecret) {
    this.registry = new SchemaRegistry({
      host,
      auth: {
        username: `${apiKey}`,
        password: `${apiSecret}`,
      },
    });
  }

  async getSchemaId(schema) {
    const { id } = await this.registry.register({
      type: SchemaType.AVRO,
      schema: JSON.stringify(schema),
    });

    return id;
  }

  async encodePayload(schema, payload) {
    const schemaId = await this.getSchemaId(schema);

    return this.registry.encode(schemaId, payload);
  }

  async decodePayload(value) {
    return this.registry.decode(value);
  }
}

module.exports = RegisterService;
