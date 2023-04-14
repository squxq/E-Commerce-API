"use strict";
const { ElasticSearchMap } = require("./plugins");
const elasticsearchMap = new ElasticSearchMap();
// elasticsearch mapping
const productMapping = {
    properties: {
        id: {
            type: "keyword",
        },
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
    },
};
const productAVROSchema = {
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
        on_write: "(variants.price !== null) && (Object.keys(variants).length > 1)",
    },
    name: "ProductsSchema",
    namespace: "com.ecommerceapi",
    type: "record",
};
const idAVROSchema = {
    fields: [
        {
            name: "id",
            type: "string",
        },
    ],
    name: "IdsSchema",
    namespace: "com.ecommerceapi",
    type: "record",
};
// creating a elasticsearch mapping
// elasticsearchMap.createMap("products", productMapping).catch((err) => console.log(err.meta.body));
module.exports = {
    avro: {
        id: idAVROSchema,
        product: productAVROSchema,
    },
    map: {
        product: productMapping,
    },
};
//# sourceMappingURL=products.schema.js.map