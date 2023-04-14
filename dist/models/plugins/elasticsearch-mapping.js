"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticSearchMap = void 0;
const db_1 = require("../../config/db");
const logger = require("../../config/logger");
class ElasticSearchMap {
    constructor() {
        this.client = db_1.elasticClient;
    }
    async createMap(index, mapping) {
        const result = await this.client.indices.putMapping(Object.assign({ index }, mapping));
        logger.debug(`Mapping added to index ${index}`);
        logger.info(result);
    }
}
exports.ElasticSearchMap = ElasticSearchMap;
//# sourceMappingURL=elasticsearch-mapping.js.map