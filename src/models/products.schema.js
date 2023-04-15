const logger = require("../config/logger");
const { ElasticSearchMap } = require("./plugins");

const elasticsearchMap = new ElasticSearchMap();

// elasticsearch mapping
const productMapping = {
  properties: {
    category: {
      type: "keyword",
    },
    name: {
      type: "text",
    },
    image: {
      type: "keyword",
    },
    description: {
      type: "text",
    },
    brand: {
      type: "keyword",
      fields: {
        raw: {
          type: "text",
        },
      },
    },
    variants: {
      type: "nested",
      dynamic: true,
      properties: {
        id: {
          type: "keyword",
        },
        price: {
          type: "integer",
        },
      },
    },
  },
};

const createProductAVROSchema = {
  fields: [
    {
      name: "category",
      type: "string",
    },
    {
      name: "name",
      type: "string",
    },
    {
      name: "description",
      type: "string",
    },
    {
      name: "image",
      type: "string",
      default: "undefined",
    },
    {
      name: "brand",
      type: "string",
      default: "undefined",
    },
    {
      name: "variants",
      type: {
        type: "map",
        values: ["null", "string", "int"],
      },
      default: {},
    },
  ],
  validate: {
    on_write: "(variants.price !== null) && (variants.id !== null) && (Object.keys(variants).length > 2)",
  },
  name: "createProductAVROSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};

const createProductItemAVROSchema = {
  fields: [
    {
      name: "variants",
      type: {
        type: "map",
        values: ["null", "string", "int"],
      },
      default: {},
    },
  ],
  validate: {
    on_write: "(variants.price !== null) && (variants.id !== null) && (Object.keys(variants).length > 1)",
  },
  name: "createProductItemAVROSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};

const updateProductAVROSchema = {
  fields: [
    {
      name: "changes",
      type: {
        type: "map",
        values: ["null", "string"],
      },
      default: {},
    },
  ],
  validate: {
    on_write: "Object.keys(changes).length > 0",
  },
  name: "updateProductAVROSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};

const udpateProductItemAVROSchema = {
  fields: [
    {
      name: "changes",
      type: {
        type: "map",
        values: ["null", "string", "int"],
      },
      default: {},
    },
  ],
  validate: {
    on_write: "(changes.id !== null) && Object.keys(changes).length > 1",
  },
  name: "udpateProductItemAVROSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};

// creating a elasticsearch mapping
elasticsearchMap.createMap("products", productMapping).catch((err) => logger.error(err.meta.body));

module.exports = {
  avro: {
    productCreate: createProductAVROSchema,
    productItemCreate: createProductItemAVROSchema,
    productUpdate: updateProductAVROSchema,
    productItemUpdate: udpateProductItemAVROSchema,
  },
  map: {
    product: productMapping,
  },
};
