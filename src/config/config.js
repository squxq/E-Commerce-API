const dotenv = require("dotenv");
const path = require("path");
const Joi = require("joi");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid("production", "development", "test").required(),
    PORT: Joi.number().default(5000),
    JWT_SECRET: Joi.string().required().description("JWT secret key"),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description("minutes after which access tokens expire"),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description("days after which refresh tokens expire"),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which reset password token expires"),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description("minutes after which verify email token expires"),
    SMTP_HOST: Joi.string().description("server that will send the emails"),
    SMTP_PORT: Joi.number().description("port to connect to the email server"),
    SMTP_USERNAME: Joi.string().description("username for email server"),
    SMTP_PASSWORD: Joi.string().description("password for email server"),
    EMAIL_FROM: Joi.string().description("the from field in the emails sent by the app"),
    INBOUND_DATABASE_URL: Joi.string().required().description("Products Database URL"),
    CLOUD_NAME: Joi.string().required().description("Cloud name to store media files"),
    CLOUD_API_KEY: Joi.string().required().description("Cloud api key for remote access"),
    CLOUD_API_SECRET: Joi.string().required().description("Cloud api secret for authentication"),
    CLOUD_PROJECT: Joi.string().default("default-project").description("Master name of the cloud project to be created"),
    EXCHANGE_RATE_KEY: Joi.string().required().description("API key for https://app.exchangerate-api.com/"),
    CSV_FILE_PATH: Joi.string().required().description("Path to the csv file"),
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

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  db: {
    inbound: envVars.INBOUND_DATABASE_URL,
    mongo: {
      mongoURI: envVars.MONGO_DATABASE_URL,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    },
  },
  cloud: {
    name: envVars.CLOUD_NAME,
    apiKey: envVars.CLOUD_API_KEY,
    apiSecret: envVars.CLOUD_API_SECRET,
    project: envVars.CLOUD_PROJECT,
  },
  exchangeRateKey: envVars.EXCHANGE_RATE_KEY,
  csvFilePath: envVars.CSV_FILE_PATH,
  kafka: {
    apiKey: envVars.KAFKA_API_KEY,
    apiSecret: envVars.KAFKA_API_SECRET,
    bootstrapURL: envVars.KAFKA_BOOTSTRAP_SERVER_URL,
    schemaHost: envVars.KAFKA_SCHEMA_HOST_URL,
    schemaKey: envVars.KAFKA_SCHEMA_API_KEY,
    schemaSecret: envVars.KAFKA_SCHEMA_API_SECRET,
  },
};
