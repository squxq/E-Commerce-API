const { Router } = require("express");
const config = require("../../../config/config");
const productRoute = require("./product.route");
const docsRoute = require("./docs.route");

const router = Router();

const defaultRoutes = [
  {
    path: "/product",
    route: productRoute,
  },
];

const devRoutes = [
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
