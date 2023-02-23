const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
// const { uploadImage, deleteImage } = require("../utils/cloudinary");

const createProduct = catchAsync(async (categoryId, name, description) => {
  // const folder = `Products/${name.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`)}`;
  const [product, variationOptions] = await prisma.$transaction([
    prisma.product.create({
      data: {
        category_id: categoryId,
        name,
        description,
      },
      select: {
        id: true,
        category_id: true,
        name: true,
        description: true,
      },
    }),
    prisma.$queryRaw`
    SELECT name,
    (
      SELECT array_agg(value) AS values
      FROM variation_option AS b
      WHERE b.variation_id = a.id
    ) FROM variation AS a
   `,
  ]);

  if (Object.keys(product).length === 0)
    throw new ApiError(httpStatus.NO_CONTENT, "The product was not created due to a system error, please try again.");

  product.variation_options = variationOptions;
  return product;
});

module.exports = {
  createProduct,
};
