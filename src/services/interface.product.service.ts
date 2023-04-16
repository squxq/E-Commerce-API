import httpStatus from "http-status";
import ApiError from "../utils/ApiError";
import { prismaInbound } from "../config/db";
import { Currencies, FxRates } from "../models";
import runInTransaction from "../utils/mongoTransaction";
import convertCurrency from "../utils/currencyConverter";

interface ISearch {
  getProductItem: (itemId: string, query: { productId?: string; currency?: string }) => Promise<AllItemInfo>;
}

interface ProductItem {
  item_id?: string;
  name?: string;
  description?: string;
  product_item_images?: string[];
  SKU?: string;
  quantity?: number;
  price?: number;
  product_id?: string;
  category_id?: string;
  image?: string;
}

interface AllItemInfo {
  item: ProductItem;
  otherItems: string[];
  categoryTree: string;
}

export class Search implements ISearch {
  private async searchProductItem(itemId: string, productId?: string): Promise<AllItemInfo> {
    const result: AllItemInfo = await prismaInbound.$transaction(async (prisma) => {
      let products: Array<ProductItem | undefined>;

      // get the product item
      if (productId) {
        products = await prisma.$queryRaw`
          SELECT i.id AS item_id, CONCAT(p.brand, ' ', p.name) AS name, p.description,
            i.images AS product_item_images, i."SKU", i."QIS" AS quantity, i.price,
            p.id AS product_id, p.category_id, p.image
          FROM product AS p
          LEFT JOIN product_item AS i
          ON i.id = ${itemId}
          WHERE p.id = ${productId}
        `;

        // if product not found
        if (!products[0]) {
          throw new ApiError(httpStatus.NOT_FOUND, `Product: ${productId} not found!`);
        } else if (!products[0].item_id) {
          throw new ApiError(httpStatus.NOT_FOUND, `Product Item: ${itemId} not found!`);
        }
      }

      products = await prisma.$queryRaw`
        SELECT i.id AS item_id, CONCAT(p.brand, ' ', p.name) AS name, p.description,
          i.images AS product_item_images, i."SKU", i."QIS" AS quantity, i.price,
          p.id AS product_id, p.category_id, p.image
        FROM product_item AS i
        INNER JOIN product AS p
        ON p.id = i.product_id
        WHERE i.id = ${itemId}
      `;

      if (!products[0]) {
        throw new ApiError(httpStatus.NOT_FOUND, `Product Item: ${itemId} not found!`);
      }

      // get additional information - about the product and the other product items
      const categoryTree: Array<{ categories: string }> = await prisma.$queryRaw`
        WITH RECURSIVE category_tree AS (
          SELECT id, name, parent_id, name AS tree_string
          FROM product_category
          WHERE id = ${products[0].category_id}

          UNION ALL

          SELECT c.id, c.name, c.parent_id, CONCAT(c.name, '/', ct.tree_string)
          FROM product_category AS c
          JOIN category_tree AS ct ON ct.parent_id = c.id
        )
        SELECT tree_string AS categories
        FROM category_tree
        ORDER BY id DESC
        LIMIT 1
      `;

      const otherProductItems: Array<{ other_items: string[] }> = await prisma.$queryRaw`
        SELECT array_agg(i.id) AS other_items
        FROM product_item AS i
        WHERE i.product_id = ${products[0].product_id}
          AND id != ${itemId}
      `;

      return {
        item: products[0],
        otherItems: otherProductItems[0]!.other_items,
        categoryTree: categoryTree[0]!.categories,
      };
    });

    return result;
  }

  private async checkCurrency(code: string, price: string): Promise<number> {
    const result = await runInTransaction(async (session) => {
      const currency = await Currencies.findOne({ code: code }, {}, { session });
      const fxRate = await FxRates.findOne(
        {
          source_currency: "USD",
          target_currency: currency?.code,
          valid_from_date: {
            $lte: new Date().toISOString(),
          },
          valid_to_date: {
            $gte: new Date().toISOString(),
          },
        },
        {},
        { session }
      );

      return { currency, fxRate };
    }).catch(() => {
      throw new ApiError(httpStatus.BAD_REQUEST, `${code} is not a valid currency!`);
    });

    if (result.currency === null) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid currency provided! ${code} is not a valid currency!`);
    }

    let exchangeRate: number;
    if (result.fxRate === null) {
      exchangeRate = await convertCurrency("USD", code);
    } else {
      exchangeRate = parseFloat(result.fxRate.exchange_rate.toString());
    }

    let formattedPrice = Math.floor(
      parseFloat(price) / result.currency.base[result.currency.base.length - 1] ** result.currency.exponent
    );

    formattedPrice = Math.round(Math.round((formattedPrice * exchangeRate + Number.EPSILON) * 10) / 10);

    return formattedPrice;
  }

  /**
   * @param itemId
   * @param query
   * @returns
   */
  async getProductItem(itemId: string, query: { productId?: string; currency?: string }) {
    // search for product item
    const allItemInfo: AllItemInfo = await this.searchProductItem(itemId, query?.productId);

    // convert the price into the pretended currency
    if (query.currency) {
      const price: number = await this.checkCurrency(query.currency, "" + allItemInfo.item.price);

      allItemInfo.item.price = price;
    }

    return allItemInfo;
  }
}
