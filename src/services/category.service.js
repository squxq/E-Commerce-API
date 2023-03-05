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
  async validateName() {
    // check if string starts with number
    this.categoryName.split("").forEach((word) => {
      if (word.match(/^\d/))
        throw new ApiError(httpStatus.BAD_REQUEST, "Category name can't have words starting with numbers");
    });

    // check for duplicate names
    let result;
    // check if category is a layer 1 category which means that it doesnt have a parent Id
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

  // validate category starting with getting the parent id
  async validateParent(categoryId, categoryName) {
    const category = await prismaProducts.$queryRaw`
      SELECT parent_id, name
      FROM product_category
      WHERE id = ${categoryId}
    `;

    if (category.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Category not found");

    if (!category[0].parent_id) {
      this.parentId = null;
    } else {
      this.parentId = category[0].parent_id;
    }

    if (categoryName) {
      this.categoryName = categoryName;
      await this.validateName();
    } else {
      this.categoryName = category[0].name;
    }

    return [this.parentId, this.categoryName];
  }

  // check for duplicate images
  async validateImage(file) {
    // verify if file is empty
    if (!file) throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");

    // image buffer
    const { content: imageBuffer } = parser(file);

    const etag = hash(imageBuffer, { algorithm: "md5" });

    const count = await prismaProducts.$queryRaw`
      SELECT a.image,
      (
        SELECT COUNT(*)::int
        FROM (
        SELECT * FROM product_category AS c
        WHERE
          CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, ${etag}, '')))
          / 32 = 1 THEN true ELSE false END
        LIMIT 1
        ) AS b
      )
      FROM product_category AS a
      WHERE a.image LIKE '%' || ${etag}
      LIMIT 1
   `;

    if (count.length === 0) {
      // upload image to cloudinary
      // folder name
      if (!this.categoryName) throw new ApiError(httpStatus.BAD_REQUEST, "To up");

      const formattedName = encodeURIComponent(
        this.categoryName
          .trim()
          .toLowerCase()
          .split(" ")
          .join("_")
          .replace(/[^a-zA-Z0-9-_]/g, "")
      );

      // upload image
      const { public_id: publicId } = await uploadImage(imageBuffer, "Category", formattedName);

      return publicId;
    }

    return count[0].image;
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
  const name = await createNewCategory.validateName();

  // upload image
  const publicId = await createNewCategory.validateImage(file);

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
 * @param { Object } imageUpdate
 * @param { String } data.categoryId
 * @returns { Object }
 */
const updateCategory = catchAsync(async (data, imageUpdate) => {
  const updateNewCategory = new Category();

  const { categoryId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.categoryId;

  // validate data object for something to update
  if (!imageUpdate && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");
  }

  // validate category Id and name update if exists
  const [parentId, name] = await updateNewCategory.validateParent(categoryId, data.name);

  // eslint-disable-next-line no-param-reassign
  data.name = name;

  // check for a duplicate image in the db
  if (imageUpdate) {
    // eslint-disable-next-line no-param-reassign
    data.image = await updateNewCategory.validateImage(imageUpdate);
  }

  const result = await prismaProducts.product_category.update({
    where: {
      id: categoryId,
    },
    data,
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
