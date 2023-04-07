import { SchemaRegistry, SchemaType, COMPATIBILITY } from "@kafkajs/confluent-schema-registry";

class RegisterService {
  registry: any;
  constructor(host: string, apiKey: string, apiSecret: string) {
    this.registry = new SchemaRegistry({
      host,
      auth: {
        username: `${apiKey}`,
        password: `${apiSecret}`,
      },
    });
  }

  async getSchemaId(schema: object) {
    const { id } = await this.registry.register(
      {
        type: SchemaType.AVRO,
        schema: JSON.stringify(schema),
      },
      { compatibility: COMPATIBILITY.BACKWARD }
    );

    return id;
  }

  async encodePayload(schema: object, payload: object) {
    const schemaId = await this.getSchemaId(schema);

    return this.registry.encode(schemaId, payload);
  }

  async decodePayload(value: any) {
    return this.registry.decode(value);
  }
}

export default RegisterService;
