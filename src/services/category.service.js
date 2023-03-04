const httpStatus = require("http-status");
const hash = require("object-hash");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { prismaProducts } = require("../config/db");
const parser = require("../utils/parser");
const { uploadImage, deleteImage } = require("../utils/cloudinary");

class Category {
  constructor(categoryName, parentId = null) {
    this.categoryName = categoryName;
    this.parentId = parentId;
  }

  // check name
  async validate() {
    // check if string starts with number
    this.categoryName.split("").forEach((word) => {
      if (word.match(/^\d/))
        throw new ApiError(httpStatus.BAD_REQUEST, "Category name can't have words starting with numbers");
    });

    // check for duplicate names
    let result;
    if (this.parentId) {
      result = await prismaProducts.$queryRaw`
        WITH RECURSIVE layer AS (
          SELECT id,
              name,
              parent_id,
              0 AS layer_number
            FROM product_category
            WHERE parent_id IS NULL

          UNION ALL

          SELECT child.id,
              child.name,
              child.parent_id,
              layer_number+1 AS layer_number
            FROM product_category child
            JOIN layer l
              ON l.id = child.parent_id
        )
        SELECT a.id, array_agg(b.name) AS names
        FROM product_category AS a
        LEFT JOIN layer AS b
        ON layer_number = (
          SELECT layer_number
          FROM layer AS c
          WHERE c.layer_number > 0
            AND c.parent_id = a.id
          LIMIT 1
        )
        WHERE a.id = ${this.parentId}
        GROUP BY a.id
      `;

      if (result.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Parent category not found");
    } else {
      result = await prismaProducts.$queryRaw`
        SELECT array_agg(a.name) AS names
        FROM product_category AS a
        WHERE a.parent_id IS NULL
      `;

      if (!result[0].names) return this.categoryName;
    }

    if (result[0].names.includes(this.categoryName)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Duplicate category name provided");
    }

    return this.categoryName;
  }

  // upload image
  async uploadImage(file) {
    // check if file is empty
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");
    }

    // file buffer from data uri string
    const image = parser(file);

    // folder name
    const formattedName = encodeURIComponent(
      this.categoryName
        .trim()
        .toLowerCase()
        .split(" ")
        .join("_")
        .replace(/[^a-zA-Z0-9-_]/g, "")
    );

    // upload image
    const { public_id: publicId } = await uploadImage(image.content, "Category", formattedName);

    return publicId;
  }
}

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentId
 * @param { String } description
 * @param { Object } file
 * @returns { Object }
 */
const createCategory = catchAsync(async (categoryName, parentId, description, file) => {
  const createNewCategory = new Category(categoryName, parentId);

  // check category name
  const name = await createNewCategory.validate();

  // upload image
  const publicId = await createNewCategory.uploadImage(file);

  // create category in product_category
  const result = await prismaProducts.product_category.create({
    data: {
      parent_id: parentId,
      name,
      image: publicId,
      description,
    },
    select: {
      id: true,
      parent_id: true,
      name: true,
      description: true,
    },
  });

  return {
    category: result,
  };
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
    // await duplicateNames(data.categoryName, parentCategoryId);
  }

  // Check for duplicate images
  const category = await prismaProducts.$queryRaw`
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
    const formattedName = encodeURIComponent(
      category[0].name
        .trim()
        .toLowerCase()
        .split(" ")
        .join("_")
        .replace(/[^a-zA-Z0-9-_]/g, "")
    );

    // if it is the only image - delete it
    if (category[0].count === 1) {
      const { result } = await deleteImage(category[0].image);
      if (result === "not found") throw new ApiError(httpStatus.NOT_FOUND, "Image not found, deletion interrupted");
    }

    // upload image
    const { public_id: publicId } = await uploadImage(bufferImage.content, "Category", formattedName);
    data.image = publicId;
  }
  const result = await prismaProducts.product_category.update({
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

  if (Object.keys(result).length === 0)
    throw new ApiError(httpStatus.NO_CONTENT, "The category was not updated due to a system error, please try again.");

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

  const category = await prismaProducts.$queryRaw`
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
  await prismaProducts.$queryRaw`
    DELETE FROM product_category WHERE id = ${category[0].id}
  `;
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
