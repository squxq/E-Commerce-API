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
  let mainImage;
  let hasMain = false;
  if (images.find((image) => image.fieldname === "main")) {
    mainImage = images.find((image) => image.fieldname === "main");
    images.splice(images.indexOf(mainImage), 1);
  } else {
    mainImage = images[0];
    images = images.slice(1);
    hasMain = true;
  }

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

  const { public_id: mainPublicId } = await uploadImage(mainImage.content, folder, `${formattedName}_main`);

  const result = await prisma.$transaction([
    prisma.product.create({
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
    }),
    prisma.$queryRaw`
    SELECT exchange_rate
    FROM fx_rates
    WHERE (source_currency = ${price.currency} AND target_currency = 'USD')
    AND (extract(epoch from now()) BETWEEN valid_from_date AND valid_to_date)
    `,
  ]);
  // check for irregularities
  if (!result[0]) throw new ApiError(httpStatus.NO_CONTENT, "The product was not created, please retry");

  let convertedPrice;
  price.value = Math.round((price.value + Number.EPSILON) * 100) / 100;
  // conversion from customers currency to usd
  if (result[1].length === 0) {
    convertedPrice = convertCurrency(price.value, price.currency, "USD");
  } else {
    convertedPrice = +result[1][0].exchange_rate * price.value;
  }
  // Math.round((num + Number.EPSILON) * 100) / 100 - Number.EPSILON = 2.7755575615628914e-17
  convertedPrice = Math.round((convertedPrice + Number.EPSILON) * 100) / 100;

  // product_item images
  const imagesPromises = images.map(async (image) => {
    const { public_id: publicId } = await uploadImage(parser(image).content, folder, formattedName);
    return publicId;
  });
  const uploadedImages = await Promise.all(imagesPromises);
  if (hasMain) uploadedImages.unshift(mainPublicId);

  // const productItem = await prisma.product_item.create({
  //   data: {
  //     product_id: result[0].id,
  //     SKU: ,
  //     QIS: Math.floor(quantity),
  //     images: ,
  //     price: convertedPrice,
  //   }
  // })
});

module.exports = {
  createProduct,
};
