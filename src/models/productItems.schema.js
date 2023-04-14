module.exports = {
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
    on_write: "(variants.price !== null) && (Object.keys(variants).length > 1)",
  },
  name: "ProductItemsSchema",
  namespace: "com.ecommerceapi",
  type: "record",
};
