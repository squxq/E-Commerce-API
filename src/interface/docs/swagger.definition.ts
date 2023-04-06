import { config } from "../config";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "E-Commerce-API Interface API",
    version: "0.0.1",
    description: "This is part of a full E-Commerce-API.",
    license: {
      name: "MIT",
      url: "https://github.com/squxq/E-Commerce-API/blob/master/LICENSE",
    },
  },
  servers: [
    {
      url: `http://localhost:${config.interfacePort}/v1`,
      description: "Development Server",
    },
  ],
};

export default swaggerDefinition;
