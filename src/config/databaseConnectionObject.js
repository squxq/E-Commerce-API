const config = require("./config");

const databaseConnectionObject = {
  host: config.products.host,
  port: config.products.port,
  database: config.products.name,
  user: config.products.user,
  password: config.products.password,
};

module.exports = databaseConnectionObject;
