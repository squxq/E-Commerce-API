CREATE TABLE product_category(
  id TEXT PRIMARY KEY NOT NULL,
  parent_category_id TEXT REFERENCES product_category(id),
  category_name TEXT NOT NULL
);

CREATE TABLE product(
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES product_category(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  product_image TEXT NOT NULL
);

CREATE TABLE variation(
  id INTEGER PRIMARY KEY,
  category_id INTEGER REFERENCES product_category(id),
  name VARCHAR(255) NOT NULL
);

CREATE TABLE product_item(
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES product(id),
  SKU VARCHAR(255) NOT NULL,
  QIS INTEGER,
  product_image TEXT NOT NULL,
  price INTEGER
);

CREATE TABLE variation_option(
  id INTEGER PRIMARY KEY,
  variation_id INTEGER REFERENCES variation(id)
  value TEXT NOT NULL
);

CREATE TABLE product_configuration(
  product_item_id INTEGER REFERENCES product_item(id),
  variation_option_id INTEGER REFERENCES variation_option(id)
);
