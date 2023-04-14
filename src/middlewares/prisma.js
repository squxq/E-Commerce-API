const prismaMiddleware = async (params, next) => {
  return next(params);
};

module.exports = prismaMiddleware;
