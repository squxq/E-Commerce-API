const express = require("express");
const authRoute = require("./auth.route");
const docsRoute = require("./docs.route");
const productRoute = require("./product.route");
const categoryRoute = require("./category.route");
const variationRoute = require("./variation.route");
const config = require("../../../config/config");

const router = express.Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  {
    path: "/category",
    route: categoryRoute,
  },
  {
    path: "/product",
    route: productRoute,
  },
  {
    path: "/variation",
    route: variationRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: "/docs",
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

if (config.env === "development") {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
