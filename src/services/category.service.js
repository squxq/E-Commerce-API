const httpStatus = require("http-status");
// const { v4: uuidv4 } = require("uuid");
const hash = require("object-hash");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const prisma = require("../config/db");
const parser = require("../utils/parser");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const { duplicateNames } = require("../utils/duplicates");
// const config = require("../config/config");

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentCategoryId
 * @param { Object } file
 * @returns { Object<id|parent_category_id|category_name|category_image|category_description> }
 */
const createCategory = catchAsync(async (categoryName, parentCategoryId, file, categoryDescription) => {
  // check if field is empty
  if (!categoryName) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category name not provided");
  } else if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");
  }
  // check for duplicate names
  await duplicateNames(categoryName, parentCategoryId);

  // file buffer from data uri string
  const image = parser(file);

  // folder name
  const formattedName = categoryName
    .trim()
    .toLowerCase()
    .split(" ")
    .join("_")
    .replace(/[^a-zA-Z0-9-_]/g, "");

  // upload image
  const { public_id: publicId } = await uploadImage(image.content, "Category", formattedName);

  // create category in product_category
  const result = await prisma.product_category.create({
    data: {
      parent_id: parentCategoryId,
      name: categoryName,
      image: publicId,
      description: categoryDescription && categoryDescription,
    },
    select: {
      id: true,
      parent_id: true,
      name: true,
      description: true,
    },
  });

  return result;
});

/**
 * @desc Update category
 * @param { Object } data
 * @param { Object } image
 * @returns { Object<id|parent_category_id|category_name|category_image|category_description> }
 */
const updateCategory = catchAsync(async (data, image) => {
  // check for data to update category
  const { categoryId, parentCategoryId = null } = data;
  delete data.categoryId;
  if (!image && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data to update category");
  }

  // check for duplicate names if data.categoryName exists
  if (data.categoryName) {
    await duplicateNames(data.categoryName, parentCategoryId);
  }

  const category = await prisma.$queryRaw`
    SELECT a.*,
     (
      SELECT COUNT(*)::int FROM
      (
        SELECT * FROM product_category AS c
        WHERE
          CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31)), '')))
          / CHAR_LENGTH(SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31 ))) = 1 THEN true ELSE false END
        LIMIT 2
      ) AS b
    )
    FROM product_category AS a
    WHERE id = ${categoryId}
  `;

  if (category.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  /* eslint no-param-reassign: ["error", { "props": false }] */
  Object.keys(data).forEach((property) => {
    data[`${property.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`).replace("category_", "")}`] = data[property];
    delete data[property];
  });

  const bufferImage = parser(image);
  if (
    image &&
    category[0].image.substring(category[0].image.length - 32) !== hash(bufferImage.content, { algorithm: "md5" })
  ) {
    // folder name
    const formattedName = category[0].name
      .trim()
      .toLowerCase()
      .split(" ")
      .join("_")
      .replace(/[^a-zA-Z0-9-_]/g, "");

    if (category[0].count === 1) {
      const { result } = await deleteImage(category[0].image);
      if (result === "not found") throw new ApiError(httpStatus.NOT_FOUND, "Image not found, deletion interrupted");
    }

    // upload image
    const { public_id: publicId } = await uploadImage(bufferImage.content, "Category", formattedName);

    data.image = publicId;
  }
  const result = await prisma.product_category.update({
    where: {
      id: category[0].id,
    },
    data,
    select: {
      id: true,
      parent_id: true,
      name: true,
      description: true,
    },
  });

  return result;
});

/**
 * @desc Delete Category by Id
 * @param { String } id
 */
const deleteCategory = catchAsync(async (id) => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category Id not specified");
  }

  const category = await prisma.$queryRaw`
    SELECT a.*,
    (
      SELECT COUNT(*)::int FROM
      (
        SELECT * FROM product_category AS c
        WHERE
          CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31)), '')))
          / CHAR_LENGTH(SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31 ))) = 1 THEN true ELSE false END
        LIMIT 2
      ) AS b
    )
    FROM product_category AS a
    WHERE id = ${id}
  `;

  if (category.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  if (category[0].count === 1) {
    const { result } = await deleteImage(category[0].image);
    if (result === "not found") throw new ApiError(httpStatus.NOT_FOUND, "Image not found, deletion interrupted");
  }
  await prisma.$queryRaw`
    DELETE FROM product_category WHERE id = ${category[0].id}
  `;
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
