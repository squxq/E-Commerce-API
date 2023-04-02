module.exports = {
  fields: [
    {
      name: "name",
      type: "string",
    },
    {
      name: "description",
      type: "string",
    },
    {
      name: "category",
      type: "string",
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
    on_write: "(variants.price !== null) && (Object.keys(variants).length > 1)",
  },
  name: "ProductsSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};
