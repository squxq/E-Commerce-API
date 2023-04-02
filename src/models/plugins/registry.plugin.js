const { SchemaRegistry, SchemaType } = require("@kafkajs/confluent-schema-registry");

class RegisterService {
  constructor(host, apiKey, apiSecret, schema) {
    this.registry = new SchemaRegistry({
      host: host,
      auth: {
        username: `${apiKey}`,
        password: `${apiSecret}`,
      },
    });

    this.schema = schema;
  }

  async getSchemaId(schema) {
    const { id } = await this.registry.register({
      type: SchemaType.AVRO,
      schema: JSON.stringify(schema),
    });

    this.schemaId = id;
  }

  async encodePayload(payload) {
    if (!this.schemaId) {
      await this.getSchemaId(this.schema);
    }

    return await this.registry.encode(this.schemaId, payload);
  }

  async decodePayload(value) {
    return await this.registry.decode(value);
  }
}

module.exports = RegisterService;
