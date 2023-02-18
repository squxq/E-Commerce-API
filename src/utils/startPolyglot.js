const Polyglot = require("node-polyglot");
const messages = require("../config/i18n");

const startPolyglot = (req, res, next) => {
  // get the locale from express-locale
  const locale = req.locale.language;

  // start polyglot and add it to the req
  req.polyglot = new Polyglot();

  // decide which phrases for polyglot will be used
  if (locale === "ar") {
    req.polyglot.extend(messages.ar);
  } else {
    req.polyglot.extend(messages.en);
  }

  next();
};

module.exports = startPolyglot;
