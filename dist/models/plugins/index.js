"use strict";
const { ElasticSearchMap: elasticClassMap } = require("./elasticsearch-mapping");
module.exports.toJSON = require("./toJSON.plugin");
module.exports.RegisterClass = require("./registry.plugin");
module.exports.ElasticSearchMap = elasticClassMap;
//# sourceMappingURL=index.js.map