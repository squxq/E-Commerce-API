const cloudinary = require("cloudinary");
const hash = require("object-hash");
const catchAsync = require("./catchAsync");
const config = require("../config/config");

cloudinary.config({
  cloud_name: config.cloud.name,
  api_key: config.cloud.apiKey,
  api_secret: config.cloud.apiSecret,
  secure: true,
});

// Uploads an image to cloudinary
const uploadImage = catchAsync(async (image, feature, name) => {
  const formattedName = name
    .trim()
    .split(" ")
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  // folder name
  const folderName = `${feature.charAt(0).toUpperCase() + feature.slice(1)}/${formattedName}`;

  const etag = hash(image, { algorithm: "md5" });
  // upload options
  const options = {
    folder: `${config.cloud.project ? config.cloud.project : "default-project"}/${folderName}`,
    resource_type: "image",
    public_id: etag,
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

module.exports = {
  uploadImage,
};
