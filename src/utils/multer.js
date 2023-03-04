const multer = require("multer");
const httpStatus = require("http-status");
const ApiError = require("./ApiError");

const storage = multer.memoryStorage();

const limits = {
  fileSize: 1024 * 1024,
};

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|WEBP|webp|jfif)$/)) {
    req.fileValidationError = "Only image files are allowed";
    return cb(new ApiError(httpStatus.BAD_REQUEST, "Not an image! Please upload only images"), false);
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
    // check if image exists
    if (!req.file) return next(new ApiError(httpStatus.BAD_REQUEST, "No image provided"));

    // check if error exists
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Cannot upload more than 1 image"));
      }
    }

    if (err) return next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err));
    next();
  });
};

/**
 * Upload any number of images with any name
 */
const anyFile = () => (req, res, next) => {
  const upload = multer({
    storage,
    limits,
    fileFilter,
  }).any();

  upload(req, res, (err) => {
    if (req.files.length === 0) return next(new ApiError(httpStatus.BAD_REQUEST, "No images provided"));
    if (err) return next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err));
    next();
  });
};

module.exports = {
  singleFile,
  anyFile,
};
