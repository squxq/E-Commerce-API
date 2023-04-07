import { elasticClient } from "../config";

const ProductMapping = {
  properties: {
    id: {
      type: "uuid",
    },
    category: {
      type: "keyword",
    },
    name: {
      type: "text",
    },
  },
};
