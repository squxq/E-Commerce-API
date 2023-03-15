const cloudinary = require("cloudinary");
const hash = require("object-hash");
const catchAsync = require("./catchAsync");
const config = require("../config/config");

cloudinary.v2.config({
  cloud_name: config.cloud.name,
  api_key: config.cloud.apiKey,
  api_secret: config.cloud.apiSecret,
  secure: true,
});

// Uploads an image to cloudinary
const uploadImage = catchAsync(async (image, folderName, fileName = null) => {
  const etag = hash(image, { algorithm: "md5" });
  // upload options
  const options = {
    folder: `${config.cloud.project ? config.cloud.project : "default-project"}/${folderName}`,
    resource_type: "image",
    public_id: fileName ? `${fileName}_${etag}` : etag,
    phash: true,
    use_filename: true,
    unique_filename: true,
    overwrite: true,
    invalidate: true,
    crop: "fit",
    format: "webp",
  };

  const upload = await cloudinary.v2.uploader.upload(image, options);

  return upload;
});

const deleteImage = catchAsync(async (publicId) => {
  const result = await cloudinary.v2.uploader.destroy(publicId, (error, output) => {
    return output;
  });
  return result;
});

module.exports = {
  uploadImage,
  deleteImage,
};
