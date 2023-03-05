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
  async updateProductsVariations(prisma, parentId, { allProducts, allVariations }) {
    let updateAllProducts;
    let updateAllVariations;

    if (allProducts.length > 0) {
      // eslint-disable-next-line no-param-reassign
      allProducts = allProducts.map((id) => [id.id]);

      updateAllProducts = await prisma.$queryRaw`
            UPDATE product AS a
            SET category_id = ${parentId}
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
            SET category_id = ${parentId}
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

  // eslint-disable-next-line class-methods-use-this
  async statusDeletedDeleteCategory(prisma, categoryId) {
    return prisma.product_category.delete({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        parent_id: true,
        name: true,
        image: true,
        description: true,
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async statusActiveDeleteCategory(prisma, categoryId) {
    return prisma.product_category.update({
      where: {
        id: categoryId,
      },
      data: {
        status: "DELETED",
      },
      select: {
        id: true,
        parent_id: true,
        name: true,
        image: true,
        description: true,
      },
    });
  }

  async updateResources(categoryId, parentId, status) {
    const updateResourcesTransaction = await prismaProducts.$transaction(async (prisma) => {
      let deletedCategory;
      let updateProducts;
      let updateVariations;

      if (status === "DELETED") {
        deletedCategory = await this.statusDeletedDeleteCategory(prisma, categoryId);
      }

      if (status === "ACTIVE") {
        const allProducts = await prisma.product.findMany({
          where: {
            category_id: categoryId,
          },
          select: {
            id: true,
          },
        });

        const allVariations = await prisma.variation.findMany({
          where: {
            category_id: categoryId,
          },
          select: {
            id: true,
          },
        });

        const { updateAllProducts, updateAllVariations } = await this.updateProductsVariations(prisma, parentId, {
          allProducts,
          allVariations,
        });

        updateProducts = updateAllProducts;
        updateVariations = updateAllVariations;

        deletedCategory = await this.statusActiveDeleteCategory(prisma, categoryId);
      }

      return {
        category: deletedCategory,
        products: updateProducts,
        variations: updateVariations,
      };
    });

    return updateResourcesTransaction;
  }

  // eslint-disable-next-line class-methods-use-this
  async updateCategories(categoryId, parentId, status) {
    const updateCategoriesTransaction = await prismaProducts.$transaction(async (prisma) => {
      let deletedCategory;
      let updateAllChildren;

      if (status === "DELETED") {
        deletedCategory = await this.statusDeletedDeleteCategory(prisma, categoryId);
      }
      if (status === "ACTIVE") {
        let allChildren = await prisma.product_category.findMany({
          where: {
            parent_id: categoryId,
          },
          select: {
            id: true,
          },
        });

        allChildren = allChildren.map((child) => [child.id]);

        updateAllChildren = await prisma.$queryRaw`
          UPDATE product_category AS a
          SET parent_id = ${parentId}
          FROM
          (
            VALUES
            ${Prisma.join(allChildren.map((row) => Prisma.sql`(${Prisma.join(row)})`))}
          ) AS b(id)
          WHERE b.id = a.id
          RETURNING a.id, a.parent_id, a.name, a.image, a.description
        `;

        deletedCategory = await this.statusActiveDeleteCategory(prisma, categoryId);
      }

      return {
        category: deletedCategory,
        categories: updateAllChildren,
      };
    });

    return updateCategoriesTransaction;
  }

  // async deleteTransaction(categoryId, parentId, status) {
  //   const deleteCategoriesTransaction = await prismaProducts.$transaction(async (prisma) => {
  //     // get the tree structure
  //     let treeIds = await prisma.$queryRaw`
  //       WITH RECURSIVE category_data AS (
  //         (
  //           SELECT id, 1 AS level
  //           FROM product_category
  //           WHERE id = ${categoryId}
  //         )

  //         UNION ALL

  //         (
  //           SELECT this.id, prior.level + 1
  //           FROM category_data prior
  //           INNER JOIN product_category this ON this.parent_id = prior.id
  //         )
  //       )
  //       SELECT e.id
  //       FROM category_data e
  //       ORDER BY e.level
  //     `;

  //     treeIds = treeIds.map((id) => id.id);

  //     let allProducts = await prisma.product.findMany({
  //       where: { id: { in: treeIds } },
  //       select: { id: true },
  //     });

  //     let allVariations = await prisma.variation.findMany({
  //       where: { id: { in: treeIds } },
  //       select: { id: true },
  //     });
  //   });

  //   return deleteCategoriesTransaction;
  // }

  async deleteCategoryTransaction(categoryId, status) {
    if (status === "DELETED") {
      return this.statusDeletedDeleteCategory(prismaProducts, categoryId);
    }

    if (status === "ACTIVE") {
      return this.statusActiveDeleteCategory(prismaProducts, categoryId);
    }
  }

  // validate check wheter the category is a last layer category or not
  async categoryDelete(categoryId) {
    const categoryTransaction = await prismaProducts.$transaction(async (prisma) => {
      const lastLayerCategory = await prisma.$queryRaw`
        SELECT b.id AS category_id, b.parent_id, b.status, array_agg(a.id) AS ids
        FROM product_category AS a
        LEFT JOIN product_category AS b
        ON b.id = ${categoryId}
        WHERE a.id NOT IN (
          SELECT b.parent_id
            FROM product_category AS b
            WHERE b.parent_id IS NOT NULL
        )
        GROUP BY b.id, b.parent_id, b.status
      `;

      if (!lastLayerCategory[0].category_id) throw new ApiError(httpStatus.NOT_FOUND, "Category not found");

      let solution;

      // check if parent_id is null - if yes bin them
      if (!lastLayerCategory[0].parent_id) {
        solution = "delete tree";
      } else if (lastLayerCategory[0].ids.includes(categoryId)) {
        // this is a category that can have variations and products, etc
        lastLayerCategory[0].ids.splice(lastLayerCategory[0].ids.indexOf(categoryId), 1);

        // check for resources before checking for siblings
        const firstProduct = await prisma.product.findFirst({
          where: {
            category_id: categoryId,
          },
          select: {
            id: true,
          },
        });
        const firstVariation = await prisma.variation.findFirst({
          where: {
            category_id: categoryId,
          },
          select: {
            id: true,
          },
        });

        if (!firstProduct && !firstVariation) {
          solution = "delete category";
        } else {
          const siblings = await prismaProducts.$queryRaw`
              SELECT array_agg(a.id) AS ids
              FROM product_category AS a
              WHERE parent_id = ${lastLayerCategory[0].parent_id} AND id != ${categoryId}
            `;

          if (siblings[0].ids) {
            solution = "delete tree";
          } else {
            solution = "update resources";
          }
        }
      } else {
        solution = "update categories";
      }

      return {
        solution,
        category_id: lastLayerCategory[0].category_id,
        parent_id: lastLayerCategory[0].parent_id,
        status: lastLayerCategory[0].status,
      };
    });

    // category transaction will return either "delete" or "update" if delete we will have two options "tree" or "category"
    // if update we will have two options "resources" or "categories"
    if (categoryTransaction.solution === "delete tree") {
      // delete all records associated with this category
      // we need the tree structure and the product and variation ids associated with that structure
      // not working still
      // const deleteTransaction = await this.deleteTransaction(
      //   categoryTransaction.category_id,
      //   categoryTransaction.parent_id,
      //   categoryTransaction.status
      // );
      // return deleteTransaction;
    }

    if (categoryTransaction.solution === "delete category") {
      const deleteCategoryTransaction = await this.deleteCategoryTransaction(
        categoryTransaction.category_id,
        categoryTransaction.status
      );

      return deleteCategoryTransaction;
    }

    if (categoryTransaction.solution === "update resources") {
      // move resources to parent category then delete category where id = categoryId
      // resources are from product and variation tables

      const updateResourcesTransaction = await this.updateResources(
        categoryTransaction.category_id,
        categoryTransaction.parent_id,
        categoryTransaction.status
      );

      return updateResourcesTransaction;
    }

    if (categoryTransaction.solution === "update categories") {
      // move children categories to parent category then delete category where id = categoryId
      // const updateCategoriesTranaction = await this.updateCategories()

      const updateCategoriesTransaction = await this.updateCategories(
        categoryTransaction.category_id,
        categoryTransaction.parent_id,
        categoryTransaction.status
      );

      return updateCategoriesTransaction;
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
    // row deletion type
    return deleteNewCategory.categoryDelete(id);
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
