const hash = require("object-hash");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { prismaProducts } = require("../config/db");
const parser = require("../utils/parser");
const { uploadImage } = require("../utils/cloudinary");

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
        SELECT id, parent_id, name
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

    this.categoryId = category[0].id;

    return {
      parentId: this.parentId,
      categoryName: this.categoryName,
    };
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

  // eslint-disable-next-line class-methods-use-this
  async updateProductsVariations(prisma, { allProducts, allVariations }) {
    let updateAllProducts;
    let updateAllVariations;

    if (allProducts.length > 0) {
      // eslint-disable-next-line no-param-reassign
      allProducts = allProducts.map((id) => [id.id]);

      updateAllProducts = await prisma.$queryRaw`
            UPDATE product AS a
            SET category_id = ${this.parentId}
            FROM
            (
              VALUES
              ${Prisma.join(allProducts.map((row) => Prisma.sql`(${Prisma.join(row)})`))}
            ) AS b(id)
            WHERE b.id = a.id
            RETURNING a.id, a.category_id, a.name, a.description, a.image
          `;
    }

    if (allVariations.length > 0) {
      // eslint-disable-next-line no-param-reassign
      allVariations = allVariations.map((id) => [id.id]);

      updateAllVariations = await prisma.$queryRaw`
            UPDATE variation AS a
            SET category_id = ${this.parentId}
            FROM
            (
              VALUES
              ${Prisma.join(allVariations.map((row) => Prisma.sql`(${Prisma.join(row)})`))}
            ) AS b(id)
            WHERE b.id = a.id
            RETURNING a.id, a.category_id, a.name
          `;
    }

    return {
      updateAllProducts,
      updateAllVariations,
    };
  }

  async updateResources() {
    const updateResourcesTransaction = await prismaProducts.$transaction(async (prisma) => {
      const allProducts = await prisma.product.findMany({
        where: {
          category_id: this.categoryId,
        },
        select: {
          id: true,
        },
      });

      const allVariations = await prisma.variation.findMany({
        where: {
          category_id: this.categoryId,
        },
        select: {
          id: true,
        },
      });

      const { updateAllProducts, updateAllVariations } = await this.updateProductsVariations(prisma, {
        allProducts,
        allVariations,
      });

      const updateProducts = updateAllProducts;
      const updateVariations = updateAllVariations;

      const deletedCategory = await prisma.product_category.delete({
        where: {
          id: this.categoryId,
        },
        select: {
          id: true,
          parent_id: true,
          name: true,
          image: true,
          description: true,
        },
      });

      return {
        category: deletedCategory,
        products: updateProducts,
        variations: updateVariations,
      };
    });

    return updateResourcesTransaction;
  }

  // eslint-disable-next-line class-methods-use-this
  async updateCategories() {
    const updateCategoriesTransaction = await prismaProducts.$transaction(async (prisma) => {
      let allChildren = await prisma.product_category.findMany({
        where: {
          parent_id: this.categoryId,
        },
        select: {
          id: true,
        },
      });

      allChildren = allChildren.map((child) => [child.id]);

      let updateAllChildren;

      if (allChildren.length > 0) {
        updateAllChildren = await prisma.$queryRaw`
          UPDATE product_category AS a
          SET parent_id = ${this.parentId}
          FROM
          (
            VALUES
            ${Prisma.join(allChildren.map((row) => Prisma.sql`(${Prisma.join(row)})`))}
          ) AS b(id)
          WHERE b.id = a.id
          RETURNING a.id, a.parent_id, a.name, a.image, a.description
        `;
      }

      const deletedCategory = await prisma.product_category.delete({
        where: {
          id: this.categoryId,
        },
        select: {
          id: true,
          parent_id: true,
          name: true,
          image: true,
          description: true,
        },
      });

      return {
        category: deletedCategory,
        categories: updateAllChildren,
      };
    });

    return updateCategoriesTransaction;
  }

  async deleteTree(lastLayer = null) {
    const deleteCategoriesTransaction = await prismaProducts.$transaction(async (prisma) => {
      let treeIds = [this.categoryId];
      if (!lastLayer) {
        // get the tree structure
        treeIds = await prisma.$queryRaw`
          WITH RECURSIVE category_data AS (
            (
              SELECT id, 1 AS level
              FROM product_category
              WHERE id = ${this.categoryId}
            )

            UNION ALL

            (
              SELECT this.id, prior.level + 1
              FROM category_data prior
              INNER JOIN product_category this ON this.parent_id = prior.id
            )
          )
          SELECT e.id
          FROM category_data e
          ORDER BY e.level
        `;

        treeIds = treeIds.map((id) => id.id);
      }

      // delete the tree - not optimal
      // https://stackoverflow.com/questions/61756075/postgres-variable-for-multiple-delete-statements check tomorrow
      const productConfigurations = await prisma.$queryRaw`
        DELETE FROM product_configuration AS a
        WHERE a.product_item_id IN (
          SELECT b.id
          FROM product_item AS b
          WHERE b.product_id IN (
            SELECT c.id
            FROM product AS c
            WHERE category_id IN (${Prisma.join(treeIds)})
          )
        )
        RETURNING a.id, a.product_item_id, a.variation_option_id
      `;

      const productItems = await prisma.$queryRaw`
        DELETE FROM product_item AS d
        WHERE d.product_id IN (
          SELECT c.id
          FROM product AS c
          WHERE category_id IN (${Prisma.join(treeIds)})
        )
        RETURNING d.id, d.product_id, d."SKU", d."QIS", d.images, d.price
      `;

      const products = await prisma.$queryRaw`
        DELETE FROM product AS e
        WHERE e.category_id IN (${Prisma.join(treeIds)})
        RETURNING e.id, e.category_id, e.name, e.description, e.image
      `;

      const variationOptions = await prisma.$queryRaw`
        DELETE FROM variation_option AS f
        WHERE f.variation_id IN (
          SELECT g.id
          FROM variation AS g
          WHERE category_id IN (${Prisma.join(treeIds)})
        )
        RETURNING f.id, f.variation_id, f.value
      `;

      const variations = await prisma.$queryRaw`
        DELETE FROM variation AS h
        WHERE h.category_id IN (${Prisma.join(treeIds)})
        RETURNING h.id, h.category_id, h.name
      `;

      const categories = await prisma.$queryRaw`
        DELETE FROM product_category AS i
        WHERE i.id IN (${Prisma.join(treeIds)})
        RETURNING i.id, i.parent_id, i.name, i.image, i.description
      `;

      return { categories, products, variations, productItems, variationOptions, productConfigurations };
    });

    return deleteCategoriesTransaction;
  }

  // validate check wheter the category is a last layer category or not
  async deleteValidation(categoryId) {
    // check if category exists
    await this.validateParent(categoryId, null);
    // check if it has resources
    const resources = await prismaProducts.$queryRaw`
      SELECT c.* FROM (
        (
          SELECT a.id
          FROM product AS a
          WHERE a.category_id = ${this.categoryId}
          LIMIT 1
        )
      UNION ALL
        (
          SELECT b.id
          FROM variation AS b
          WHERE b.category_id = ${this.categoryId}
          LIMIT 1
        )
      ) AS c
    `;

    // doesnt have resources
    if (resources.length === 0) {
      return this.updateCategories();
    }

    // has resources
    if (resources.length > 0) {
      // check for siblings
      const siblings = await prismaProducts.$queryRaw`
        SELECT id
        FROM product_category
        WHERE parent_id = ${this.parentId} AND id != ${this.categoryId}
        `;

      // if doesnt have siblings
      if (siblings.length === 0) {
        return this.updateResources();
      }

      // has siblings
      if (siblings.length > 0) {
        // tree deletion is required
        return this.deleteTree(true);
      }
    }
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
  const { categoryName: name } = await updateNewCategory.validateParent(categoryId, data.name);

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
 * @param { Object } query
 * @returns { Object }
 */
const deleteCategory = catchAsync(async (id, query) => {
  // delete will not delete unless the category status is deleted - this will create a sort of recycle bin - using something called "soft delete"
  // check if category exists - and get the category info
  const deleteNewCategory = new Category();

  // delete type ["row", "tree"] -- row deletes the row and establishes the new parent for the children / tree deletes the row and its children
  if (query.type === "row") {
    return deleteNewCategory.deleteValidation(id);
  }

  if (query.type === "tree") {
    return deleteNewCategory.deleteTree();
  }
  // with type ["tree"] it will use the function deleteTransaction() in the Category class

  // still need to check if the image can be deleted or not, and if yes, delete it

  // const category = await prismaProducts.$queryRaw`
  //   SELECT a.*,
  //   (
  //     SELECT COUNT(*)::int FROM
  //     (
  //       SELECT * FROM product_category AS c
  //       WHERE
  //         CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31)), '')))
  //         / CHAR_LENGTH(SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31 ))) = 1 THEN true ELSE false END
  //       LIMIT 2
  //     ) AS b
  //   )
  //   FROM product_category AS a
  //   WHERE id = ${id}
  // `;
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
