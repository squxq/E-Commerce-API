const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const hash = require("object-hash");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const prisma = require("../config/db");
const parser = require("../utils/parser");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const { duplicateNames } = require("../utils/duplicates");
const config = require("../config/config");

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentCategoryId
 * @param { Object } file
 * @returns { Object<id|parent_category_id|category_name|category_image|category_description> }
 */
const createCategory = catchAsync(async (categoryName, parentCategoryId, file) => {
  // check if field is empty
  if (!categoryName) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category name not provided");
  } else if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");
  }
  // check for duplicate names
  await duplicateNames(categoryName, parentCategoryId);
  // uuid for projects db
  const categoryId = uuidv4().toString();

  // file buffer from data uri string
  let image = parser(file);

  // folder name
  const formattedName = categoryName.trim().toLowerCase().split(" ").join("_");

  // folder name
  // const folderName = `Category/${formattedName}`;

  // upload image
  image = await uploadImage(image.content, "Category", formattedName);

  // create category in product_category
  const result =
    await prisma.$queryRaw`INSERT INTO product_category(id, parent_category_id, category_name, category_image) VALUES(${categoryId}, ${parentCategoryId}, ${categoryName}, ${image.secure_url}) RETURNING *
      `;

  return result[0];
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

  const category = await prisma.product_category.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  /* eslint no-param-reassign: ["error", { "props": false }] */
  Object.keys(data).forEach((property) => {
    data[`${property.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`)}`] = data[property];
    delete data[property];
  });

  let bufferImage = parser(image);
  if (
    image &&
    category.category_image.substring(category.category_image.length - 37, category.category_image.length - 5) !==
      hash(bufferImage.content, { algorithm: "md5" })
  ) {
    // folder name
    const formattedName = category.category_name.trim().toLowerCase().split(" ").join("_");

    // folder name
    // const folderName = `Category/${formattedName}`;

    // upload image
    bufferImage = await uploadImage(image.content, "Category", formattedName);

    data.category_image = bufferImage.secure_url;
  }
  const result = await prisma.product_category.update({
    where: {
      id: category.id,
    },
    data,
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
          CASE WHEN (CHAR_LENGTH(c.category_image) - CHAR_LENGTH(REPLACE(c.category_image, SUBSTRING(a.category_image from (CHAR_LENGTH(a.category_image) - 37) for 32), '')))
          / CHAR_LENGTH(SUBSTRING(a.category_image from (CHAR_LENGTH(a.category_image) - 37) for 32)) = 1 THEN true ELSE false END
        LIMIT 2
      ) AS b
    )
    FROM product_category AS a
    WHERE id = ${id}
  `;

  if (category.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  let imageName = category[0].category_image;
  imageName = imageName.substring(imageName.search(config.cloud.project) + 1, imageName.length - 5);

  if (category[0].count === 1) {
    const { result } = await deleteImage(imageName);
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
