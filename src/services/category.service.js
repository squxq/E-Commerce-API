const hash = require("object-hash");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
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

  // eslint-disable-next-line class-methods-use-this
  formatName(name) {
    return encodeURIComponent(
      name
        .trim()
        .toLowerCase()
        .split(" ")
        .join("_")
        .replace(/[^a-zA-Z0-9-_]/g, "")
    );
  }

  // check name
  async validateName() {
    // check if string starts with number

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

      if (result.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Parent category: ${this.parentId} not found!`);
    } else {
      result = await prismaProducts.$queryRaw`
        SELECT array_agg(a.name) AS names
        FROM product_category AS a
        WHERE a.parent_id IS NULL
      `;

      if (!result[0].names) return this.categoryName;
    }

    if (result[0].names.find((name) => this.formatName(name) === this.formatName(this.categoryName))) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Duplicate category name provided! ${this.categoryName} is already in use.`
      );
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

    if (category.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Category: ${categoryId} not found!`);

    if (!category[0].parent_id) {
      this.parentId = null;
    } else {
      this.parentId = category[0].parent_id;
    }

    if (categoryName && categoryName !== category[0].name) {
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
  // eslint-disable-next-line class-methods-use-this
  async validateImage(file) {
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

      // upload image
      const { public_id: publicId } = await uploadImage(imageBuffer, "Category");

      return publicId;
    }

    return count[0].image;
  }

  async deleteImageCategory(prisma) {
    // check if category image repeats in db
    const count = await prisma.$queryRaw`
      SELECT a.image,
      (
      SELECT COUNT(*)::int FROM
      (
        SELECT * FROM product_category AS c
        WHERE
        CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31)), '')))
        / 32 = 1 THEN true ELSE false END
        LIMIT 2
      ) AS b
      )
      FROM product_category AS a
      WHERE id = ${this.categoryId}
      LIMIT 2
    `;
    // [{ image: "string", count: 1 }] eg

    // delete image from cloudinary
    if (count[0].count === 1) {
      await deleteImage(count[0].image);
    }

    return prisma.product_category.delete({
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
  }

  // eslint-disable-next-line class-methods-use-this
  async updateProductsVariations(prisma, { allProducts, allVariations }, reverse, childId) {
    let updateAllProducts;
    let updateAllVariations;

    if (allProducts.length > 0) {
      // eslint-disable-next-line no-param-reassign
      allProducts = allProducts.map((id) => [id.id]);

      updateAllProducts = await prisma.$queryRaw`
            UPDATE product AS a
            SET category_id = ${reverse ? childId : this.parentId}
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
            SET category_id = ${reverse ? childId : this.parentId}
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

  async updateResources(reverse = false, childId = null, newParentId = null) {
    // if (!reverse && !childId)
    //   throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Something went wrong when updating resources");

    const updateResourcesTransaction = await prismaProducts
      .$transaction(async (prisma) => {
        const allProducts = await prisma.product.findMany({
          where: {
            category_id: newParentId || this.categoryId,
          },
          select: {
            id: true,
          },
        });

        const allVariations = await prisma.variation.findMany({
          where: {
            category_id: newParentId || this.categoryId,
          },
          select: {
            id: true,
          },
        });

        const { updateAllProducts, updateAllVariations } = await this.updateProductsVariations(
          prisma,
          {
            allProducts,
            allVariations,
          },
          reverse,
          childId
        );

        let deletedCategory;

        if (!reverse) {
          deletedCategory = await this.deleteImageCategory(prisma);
        }

        return {
          category: deletedCategory,
          products: updateAllProducts,
          variations: updateAllVariations,
        };
      })
      .catch((err) => {
        if (err.meta.code === "23505") {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Resources cant be saved. Change: save=false or change resources data: ${err.meta.message}.`
          );
        }

        throw new ApiError(httpStatus.BAD_REQUEST, `Resources cant be saved. Change: save=false. ${err.meta.message}.`);
      });

    return updateResourcesTransaction;
  }

  // eslint-disable-next-line class-methods-use-this
  async updateCategories() {
    const updateCategoriesTransaction = await prismaProducts
      .$transaction(async (prisma) => {
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
          RETURNING a.id, a.parent_id, a.name, a.description, a.image
        `;
        }

        const deletedCategory = await this.deleteImageCategory(prisma);

        return {
          category: deletedCategory,
          categories: updateAllChildren,
        };
      })
      .catch((err) => {
        if (err.meta.code === "23505") {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Resources cant be saved. Change: save=false or change resources data: ${err.meta.message}.`
          );
        }

        throw new ApiError(httpStatus.BAD_REQUEST, `Resources cant be saved. Change: save=false. ${err.meta.message}.`);
      });

    return updateCategoriesTransaction;
  }

  async deleteTree(lastLayer, categoryId = null) {
    const deleteCategoriesTransaction = await prismaProducts.$transaction(async (prisma) => {
      let treeIds = [this.categoryId];
      if (!lastLayer) {
        await this.validateParent(categoryId, null);

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
              LEFT JOIN product_category this ON this.parent_id = prior.id
            )
          )
          SELECT e.id
          FROM category_data e
          ORDER BY e.level
        `;

        treeIds = treeIds.map((id) => id.id);
      }

      let productConfigurations;
      let productItems;
      let products;
      let variationOptions;
      let variations;

      let productIds = await prisma.$queryRaw`
        SELECT c.id
        FROM product AS c
        WHERE c.category_id IN (${Prisma.join(treeIds)})
      `;

      if (productIds.length > 0) {
        productIds = productIds.map((obj) => obj.id);

        productConfigurations = await prisma.$queryRaw`
          DELETE FROM product_configuration AS a
          WHERE a.product_item_id IN (
            SELECT b.id
            FROM product_item AS b
            WHERE b.product_id IN (${Prisma.join(productIds)})
          )
          RETURNING a.id, a.product_item_id, a.variation_option_id
        `;

        productItems = await prisma.$queryRaw`
          DELETE FROM product_item AS d
          WHERE d.product_id IN (${Prisma.join(productIds)})
          RETURNING d.id, d.product_id, d."SKU", d."QIS", d.images, d.price
        `;

        products = await prisma.$queryRaw`
          DELETE FROM product AS e
          WHERE e.id IN (${Prisma.join(productIds)})
          RETURNING e.id, e.category_id, e.name, e.description, e.image
        `;
      }

      let variationIds = await prisma.$queryRaw`
        SELECT f.id
        FROM variation AS f
        WHERE f.category_id IN (${Prisma.join(treeIds)})
      `;

      if (variationIds.length > 0) {
        variationIds = variationIds.map((obj) => obj.id);

        variationOptions = await prisma.$queryRaw`
          DELETE FROM variation_option AS f
          WHERE f.variation_id IN (${Prisma.join(variationIds)})
          RETURNING f.id, f.variation_id, f.value
        `;

        variations = await prisma.$queryRaw`
          DELETE FROM variation AS h
          WHERE h.id IN (${Prisma.join(variationIds)})
          RETURNING h.id, h.category_id, h.name
        `;
      }

      const imagePublicIds = await prisma.$queryRaw`
        SELECT a.image,
        (
        SELECT COUNT(*)::int FROM
        (
          SELECT * FROM product_category AS c
          WHERE
          CASE WHEN (CHAR_LENGTH(c.image) - CHAR_LENGTH(REPLACE(c.image, SUBSTRING(a.image from (CHAR_LENGTH(a.image) - 31)), '')))
          / 32 = 1 THEN true ELSE false END
          LIMIT 2
        ) AS b
        )
        FROM product_category AS a
        WHERE id IN (${Prisma.join(treeIds)})
      `;

      const imageCount = {};
      imagePublicIds.forEach(async ({ image, count }) => {
        if (count === 1) {
          await deleteImage(image);
        } else if (image in imageCount) {
          if (imageCount[image] - 1 === 0) {
            await deleteImage(image);
          } else {
            imageCount[image] -= 1;
          }
        } else {
          imageCount[image] = count - 1;
        }
      });

      const categories = await prisma.$queryRaw`
        DELETE FROM product_category AS i
        WHERE i.id IN (${Prisma.join(treeIds)})
        RETURNING i.id, i.parent_id, i.name, i.image, i.description
      `;

      return { categories, products, variations, productItems, variationOptions, productConfigurations };
    });

    return deleteCategoriesTransaction;
  }

  async checkResources(parentId = null) {
    const resources = await prismaProducts.$queryRaw`
      SELECT c.* FROM (
        (
          SELECT a.id
          FROM product AS a
          WHERE a.category_id = ${parentId || this.parentId}
          LIMIT 1
        )
      UNION ALL
        (
          SELECT b.id
          FROM variation AS b
          WHERE b.category_id = ${parentId || this.parentId}
          LIMIT 1
        )
      ) AS c
    `;

    return resources;
  }

  // validate check wheter the category is a last layer category or not
  async deleteValidation(categoryId) {
    // check if category exists
    await this.validateParent(categoryId, null);
    // check if it has resources
    const resources = await this.checkResources();

    // doesnt have resources
    if (resources.length === 0) {
      return this.updateCategories();
    }

    // has resources
    // check for parent id
    if (!this.parentId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Its not possible to save resources deleting the current category. Change: save=false in order to delete the category."
      );
    }

    if (resources.length > 0) {
      // check for siblings
      const siblings = await prismaProducts.$queryRaw`
        SELECT id
        FROM product_category
        WHERE parent_id = ${this.parentId} AND id != ${this.categoryId}
        `;

      // if it doesnt have siblings
      if (siblings.length === 0) {
        return this.updateResources();
      }

      // has siblings
      if (siblings.length > 0) {
        // tree deletion is required
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Its not possible to save resources deleting the current category. Change: save=false in order to delete the category."
        );
      }
    }
  }

  // create and update incompatibilities - creates on top of existing resources / moves to category with existing resources
  async checkIncompatibilities(save, childId, newParentId = null) {
    // check for existing reources
    // if (parentId) this.categoryId = parentId;
    const resources = await this.checkResources(newParentId);

    // has resources
    if (resources.length !== 0) {
      // if customer wants to delete resources - tree deletion
      if (!save) {
        return this.deleteTree(true);
      }

      // if user wants to maintain resources
      return this.updateResources(true, childId, newParentId);
    }
  }
}

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentId
 * @param { String } description
 * @param { Object } file
 * @param { Object } query
 * @returns { Object }
 */
const createCategory = catchAsync(async (categoryName, parentId, description, file, query) => {
  const createNewCategory = new Category(categoryName, parentId);

  // check category name and parent id
  const name = await createNewCategory.validateName();

  // upload image
  const publicId = await createNewCategory.validateImage(file);

  // create category in product_category
  let result = await prismaProducts.product_category.create({
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
      image: true,
      description: true,
    },
  });

  const incompatibilities = await createNewCategory.checkIncompatibilities(query.save, result.id).catch(async () => {
    // delete just created category
    await prismaProducts.product_category.delete({
      where: {
        id: result.id,
      },
    });

    result = undefined;
  });

  return {
    category: result,
    incompatibilities,
  };
});

/**
 * @desc Update category
 * @param { Object } data
 * @param { Object } imageUpdate
 * @returns { Object }
 */
const updateCategory = catchAsync(async (data, imageUpdate) => {
  const updateNewCategory = new Category();

  const { categoryId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.categoryId;

  // validate data object for something to update
  if (!imageUpdate && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided!");
  }

  // validate category Id and name update if exists
  const { categoryName: name } = await updateNewCategory.validateParent(categoryId, data.name);

  // eslint-disable-next-line no-param-reassign
  data.name = name;

  if (imageUpdate) {
    // check for a duplicate image in the db
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
      image: true,
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
  const deleteNewCategory = new Category();

  if (query.save) {
    return deleteNewCategory.deleteValidation(id);
  }

  return deleteNewCategory.deleteTree(false, id);
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
