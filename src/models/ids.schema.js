const idAVROSchema = {
  fields: [
    {
      name: "id",
      type: "string",
    },
    {
      name: "action",
      type: {
        type: "string",
        logicalType: "enum",
        symbols: ["CREATE", "UPDATE", "DELETE"],
      },
      default: "CREATE",
    },
    {
      name: "content",
      type: {
        type: "string",
        logicalType: "enum",
        symbols: ["PRODUCT", "ITEM"],
      },
      default: "PRODUCT",
    },
  ],
  name: "IdsSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};

module.exports = idAVROSchema;
