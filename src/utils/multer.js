const multer = require("multer");
const httpStatus = require("http-status");
const ApiError = require("./ApiError");

const storage = multer.memoryStorage();

const limits = {
  fileSize: 1024 * 1024,
};

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|WEBP|webp)$/)) {
    req.fileValidationError = "Only image files are allowed!";
    return cb(new ApiError("Not an image! Please upload only images", httpStatus.BAD_REQUEST), false);
  }
  cb(null, true);
};

/**
 * Upload single image
 * @param { String } name
 */
const singleFile = (name) => (req, res, next) => {
  const upload = multer({
    storage,
    limits,
    fileFilter,
  }).single(name);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError("Cannot upload more than 1 image", httpStatus.INTERNAL_SERVER_ERROR));
      }
    }

    if (err) return next(new ApiError(err, httpStatus.INTERNAL_SERVER_ERROR));
    next();
  });
};

/**
 * Upload any number of images with any name
 */
const anyMulter = () => (req, res, next) => {
  const upload = multer({
    storage,
    limits,
    fileFilter,
  }).any();

  upload(req, res, (err) => {
    if (err) return next(new ApiError(err, httpStatus.INTERNAL_SERVER_ERROR));
    next();
  });
};

module.exports = {
  singleFile,
  anyMulter,
};
