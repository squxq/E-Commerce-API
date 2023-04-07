import Joi from "joi";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid("production", "development", "test").required(),
    INTERFACE_PORT: Joi.number().default(5000),
    ELASTIC_SEARCH_URI: Joi.string().required().description("Elastic search URI"),
    ELASTIC_SEARCH_USERNAME: Joi.string().required().description("Elastic search username"),
    ELASTIC_SEARCH_PASSWORD: Joi.string().required().description("Elastic search password"),
    MONGO_DATABASE_URL: Joi.string().required().description("Mongo DB url"),
    KAFKA_API_KEY: Joi.string().required().description("Kafka API key"),
    KAFKA_API_SECRET: Joi.string().required().description("Kafka API secret"),
    KAFKA_BOOTSTRAP_SERVER_URL: Joi.string().required().description("Kafka Bootstrap server URL"),
    KAFKA_SCHEMA_HOST_URL: Joi.string().required().description("Kafka schema host URL"),
    KAFKA_SCHEMA_API_KEY: Joi.string().required().description("Kafka schema API key"),
    KAFKA_SCHEMA_API_SECRET: Joi.string().required().description("Kafka schema API secret"),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: "key" } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  interfacePort: envVars.INTERFACE_PORT,
  elastic: {
    elasticSearchURI: envVars.ELASTIC_SEARCH_URI,
    elasticSearchUsername: envVars.ELASTIC_SEARCH_USERNAME,
    elasticSearchPassword: envVars.ELASTIC_SEARCH_PASSWORD,
  },
  db: {
    mongo: {
      mongoURI: envVars.MONGO_DATABASE_URL,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    },
  },
  kafka: {
    apiKey: envVars.KAFKA_API_KEY,
    apiSecret: envVars.KAFKA_API_SECRET,
    bootstrapURL: envVars.KAFKA_BOOTSTRAP_SERVER_URL,
    schemaHost: envVars.KAFKA_SCHEMA_HOST_URL,
    schemaKey: envVars.KAFKA_SCHEMA_API_KEY,
    schemaSecret: envVars.KAFKA_SCHEMA_API_SECRET,
  },
};

export default config;
