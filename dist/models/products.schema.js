"use strict";
module.exports = [
    {
        fields: [
            {
                name: "id",
                type: "string",
            },
        ],
        name: "IdsSchema",
        namespace: "com.ecommerceapi",
        type: "record",
    },
    {
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
    },
];
//# sourceMappingURL=products.schema.js.map