const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const parser = require("../utils/parser");
const convertCurrency = require("../utils/currencyConverter");

const createProduct = catchAsync(async (data, images) => {
  const { categoryId, name, description, quantity, price, options } = data;

  // check the allowed options for product configuration
  const allowedOptions = await prisma.$queryRaw`
    SELECT c.name, array_agg(value) AS values
    FROM variation_option AS a
    JOIN variation AS c
    ON a.variation_id = c.id
    WHERE variation_id IN
    (
      SELECT id
      FROM variation AS b
      WHERE b.category_id = ${categoryId}
    )
    GROUP BY a.variation_id, c.name
    ORDER BY c.name ASC
  `;

  // validate options object
  Object.entries(options).forEach(([key, value]) => {
    const exists = allowedOptions.find((option) => {
      if (option.name === key) {
        if (!option.values.includes(value)) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Wrong variation option provided for: ${key}, value: ${value} does not exist`
          );
        }
      }
      return option.name === key;
    });

    if (!exists) throw new ApiError(httpStatus.BAD_REQUEST, `Wrong variation option provided for: ${key}`);
  });

  // check for a main image
  let mainImage = images.find((image) => image.fieldname === "main")
    ? images.find((image) => image.fieldname === "main")
    : images[0];

  mainImage = parser(mainImage);

  // upload image
  const formattedName = encodeURIComponent(
    name
      .trim()
      .toLowerCase()
      .split(" ")
      .join("_")
      .replace(/[^a-zA-Z0-9-_]/g, "")
  );
  const folder = `Products/${formattedName}`;

  const { public_id: mainPublicId } = await uploadImage(mainImage.content, folder, formattedName);

  const product = await prisma.product.create({
    data: {
      category_id: categoryId,
      name,
      description,
      image: mainPublicId,
    },
    select: {
      id: true,
      category_id: true,
      name: true,
      description: true,
      image: true,
    },
  });
  // check for irregularities
  if (!product) throw new ApiError(httpStatus.NO_CONTENT, "The product was not created, please retry");

  convertCurrency(price.value, price.currency, "USD");

  // if (!product) throw new ApiError(httpStatus.NO_CONTENT, "Product was not created, please try again");
  // const [product, variationOptions] = await prisma.$transaction([
  //   prisma.product.create({
  //     data: {
  //       category_id: categoryId,
  //       name,
  //       description,
  //     },
  //     select: {
  //       id: true,
  //       category_id: true,
  //       name: true,
  //       description: true,
  //     },
  //   }),
  //   prisma.$queryRaw`
  //   SELECT name,
  //   (
  //     SELECT array_agg(value) AS values
  //     FROM variation_option AS b
  //     WHERE b.variation_id = a.id
  //   ) FROM variation AS a
  //  `,
  // ]);
  // if (Object.keys(product).length === 0)
  //   throw new ApiError(httpStatus.NO_CONTENT, "The product was not created due to a system error, please try again.");
  // product.variation_options = variationOptions;
  // return product;
});

module.exports = {
  createProduct,
};
