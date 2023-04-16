// module.exports = ["ar", "en"];

const messages = {
  en: {
    successCategoryCreate: "Category successfully created.",
    successCategoryUpdate: "Category successfully updated.",
    successCategoryDelete: "Category successfully deleted.",
    successVariationCreate: "Variation successfully created.",
    successVariationUpdate: "Variation successfully updated.",
    successVariationDelete: "Variation successfully deleted.",
    successVariationOptionCreate: "Variation Option(s) successfully created.",
    successVariationOptionUpdate: "Variation Option successfully updated.",
    successVariationOptionDelete: "Variation Option successfully deleted.",
    successProductCreate: "Product successfully created.",
    successProductUpdate: "Product successfully updated.",
    successProductDelete: "Product successfully deleted.",
    successProductItemCreate: "Product Item successfully created.",
    successProductItemUpdate: "Product Item successfully updated.",
    successProductItemDelete: "Product Item successfully deleted.",
    successProductsGet: "Products successfully retrieved.",
    successProductItemGet: "Product Item successfully retrieved.",
  },
  // en: {
  //   profileImageRequired: "Profile image ss required, please upload an image!",
  //   fieldsRequired: "All fields are required.",
  //   passwordLength: "Password must be longer than 8 characters and contains letters, numbers, and symbols.",
  //   roleRestriction: "Role must be one of the following: user or seller.",
  //   emailTaken: "Email is already taken.",
  //   emailPasswordRequired: "Please enter both email and password!",
  //   incorrectEmailOrPassword: "Incorrect email or password.",
  //   passConfirm: "Password and passwordConfirmation must be the same.",
  //   invalidLink: "Invalid link or expired",
  //   notSamePassword: "This is not your password. Please enter the correct current password.",
  //   loginAgain: "Please login again!",
  //   noTokenFound: "No token found.",
  //   noUserFound: "No user found.",
  //   emailVerified: "Email is already verified.",
  //   noProductFound: "No product found with this ID.",
  //   productExist: "Product already exits",
  //   noProductsFound: "No products found.",
  //   invalidRequest: "Invalid request.",
  //   noCartForUser: "No cart found for user with this email.",
  //   noCartFound: "No cart found.",
  //   noProductInCartWithID: "No product found with this ID in the cart.",
  //   noCategories: "No categories found.",
  //   noCategoryFound: "No category found with this ID.",
  //   categoryImageRequired: "Image is required, please upload an image!",
  //   noOrders: "No orders found",
  //   noOrder: "No order found",
  //   noFavoriteListFound: "No favorite list found.",
  //   noProductsInFavorite: "No products on the favorite list found",
  //   selectImage: "Please select an image!",
  //   notSeller: "Sorry you are not the owner of this product, you cannot perform this operation.",
  //   selectImages: "Please select one or more images!",
  //   noReviewsFound: "No reviews found.",
  //   noReviewFound: "No review found with this ID",
  //   onlyOneReview: "Sorry, you cannot write more than one review.",
  //   ratingLessThanOne: "Sorry but rating cannot be less than one.",
  //   notReviewCreator: "Sorry you are not the creator of this review. You are not authorized to perform this action.",
  //   noUsersFound: "No users found.",
  //   noDiscountCodeFound: "No discount code found.",
  //   haveDiscountCode: "You have now a discount code, please use it before using another one.",
  //   noDiscountCodesFound: "No discount codes found",
  //   noUserFoundWithID: "No user found with this ID.",
  //   notFoundInFavoriteList: "Product not found in favorite list.",
  //   colorExists: "Color already exists.",
  //   sizeExists: "Size already exists",
  //   noColorExists: "Color does not exist.",
  //   noSizeExists: "Size does not exist.",
  //   notInStatusEnum:
  //     "Sorry by status must be one of the following: Not Processed, Processing, Shipped, Delivered, Cancelled.",
  //   notColorOrSizesRoute: "Sorry this is not the right route to update colors and sizes.",
  //   passwordUpdateRoute: "Cannot update password from here, please go to update password route.",
  //   successfulSignUp: "Account created successful, please verify your email!",
  //   successfulLogin: "User logged in successfuly.",
  //   successfulLogout: "Logged out successfuly.",
  //   successfulAddProductColor: "Color added successfully.",
  //   successfulAddProductSize: "Size added successfully.",
  //   successfulDeleteProductColor: "Color deleted successfully.",
  //   successfulDeleteProductSize: "Size deleted successfully.",
  //   successfulTokenGeneration: "Tokens generated successfully.",
  //   successfulPasswordChange: "Password changed successfully.",
  //   successfulEmailVerification: "Email verified successfully.",
  //   successfulResetLink: "Reset password link sent successfully.",
  //   successfulSendVerificationEmail: "Verification email sent successfully.",
  //   successfulItemAddToCart: "Item added to cart successfully.",
  //   successfulReduceByOne: "Item reduced by one from cart successfully.",
  //   successfulIncreaseByOne: "Item increased by one in cart successfully.",
  //   successfulCartFound: "Cart found successfully.",
  //   successfulCartDelete: "Cart deleted successfully.",
  //   successfulDeleteItemFromCart: "Item deleted from cart successfully.",
  //   successfulCategoryCreate: "Category created successfully.",
  //   successfulCategoriesFound: "Found categories successfully.",
  //   successfulCategoryFound: "Category found successfully.",
  //   successfulCategoryDetails: "Category details updated successfully.",
  //   successfulCategoryImage: "Category image updated successfully.",
  //   successfulCategoryDelete: "Category deleted successfully.",
  //   successfulOrderCreate: "Order created successfully.",
  //   successfulOrdersFound: "Orders found successfully.",
  //   successfulOrderFound: "Order found successfully.",
  //   successfulOrderCancel: "Order cancelled successfully.",
  //   successfulFavoriteAdd: "Product added to favorite list successfully.",
  //   successfulFavoriteGet: "Favorite list successfully retrieved.",
  //   successfulProductsFound: "Products found successfully.",
  //   successfulProductFound: "Product found successfully.",
  //   successfulProductCreate: "Product created successfully.",
  //   successfulProductDetails: "Product detials updated successfully.",
  //   successfulProductMainImage: "Product main image updated successfully.",
  //   successfulProductSubImages: "Product sub images updated successfully.",
  //   successfulProductDelete: "Product deleted successfully.",
  //   successfulReviewCreate: "Review created successfully.",
  //   successfulReviewsFound: "Reviews found successfully.",
  //   successfulReviewFound: "Review found successfully.",
  //   successfulReviewUpdate: "Review updated successfully.",
  //   successfulReviewDelete: "Review deleted successfully.",
  //   successfulUsersFound: "Users found successfully.",
  //   successfulUserFound: "User found successfully.",
  //   successfulUserDetails: "User details updated successfully.",
  //   successfulUserImage: "User image updated successfully.",
  //   successfulUserDelete: "Account deleted successfully.",
  //   successfulDeleteYourAccount: "Your account deleted successfully.",
  //   productStatics: "These are some statistics about products.",
  //   successfulDeleteProductFromFavorite: "Product deleted from favorite list successfully.",
  //   successfulProductFoundInFavorite: "Product in favorite list.",
  //   successfulCodeVerification: "Discount code verification completed successfully.",
  //   successfulDiscountCodesFound: "Discount codes found successfully.",
  //   successfulCodeGeneration: "Discount code generated successfully.",
  //   successfulStatusUpdate: "Order status updated successfully.",
  //   discountCodeDeleted: "Discount code deleted successfully.",
  //   discountCodeCanceled: "Discount code cancelled from order successfully.",
  //   successfulGetDiscount: "Discount found successfully.",
  // },
  ar: {
    profileImageRequired: "الصورة الشخصية مطلوبة. رجاءً قم برفع صورة.",
    fieldsRequired: "برجاء إدخال جميع البيانات.",
    passwordLength: "كلمة المرور لا يجب أن تقل عن 8 أحرف ومكونة من أحرف وأرقام ورموز.",
    roleRestriction: "نوع الحساب يجب أن يكون واحد من هؤلاء: مستخدم أو بائع.",
    emailTaken: "البريد الإلكتروني مستخدم من قبل.",
    emailPasswordRequired: "برجاء إدخال كلاً من البريد الإلكتروني وكلمة المرور.",
    incorrectEmailOrPassword: "خطأ في البريد الإلكتروني أو كلمة المرور.",
    loginAgain: "رجاءً, قم بتسجيل الدخول مرةً أُخري!",
    passConfirm: "يجب علي كلمة المرور وتأكيد كلمة المرور ان يكونوا متشابهين.",
    invalidLink: "الرابط غير صحيح او مدته انتهت.",
    noTokenFound: "لم يتم العثور علي الرمز.",
    noUserFound: "لم يتم العثور علي المستخدم.",
    noProductFound: "لم يتم العثور علي منتج بهذا الرقم.",
    noProductsFound: "لم يتم العثور علي أي منتجات",
    productExist: "المنتج موجود بالفعل.",
    emailVerified: "البريد الإلكتروني مفعلا.",
    invalidRequest: "طلب مرفوض.",
    notSamePassword: "هذه ليست كلمة المرور الخاصة بك. برجاء ادخال كلمة المرور الحالية.",
    noCartForUser: "لم يتم العثور علي السلة الخاصة بالمسخدم الذي بريده الإلكتروني.",
    noCartFound: "لم يتم العثور علي سلة المشتريات.",
    noProductInCartWithID: "لم يتم العثور علي المنتج الذي رقمه في سلة المشتريات.",
    noCategories: "لم يتم العثور علي أي تصنيفات.",
    noCategoryFound: "لم يتم العثور علي تصنيف بهذا الرقم.",
    categoryImageRequired: "الصورة مطلوبة. برجاء رفع صورة!",
    noOrders: "لم يتم العثور علي أي طلبات.",
    noOrder: "لم يتم العثور علي ذلك الطلب.",
    noFavoriteListFound: "لم يتم العثور علي قائمة المفضلة.",
    noProductsInFavorite: "لم يتم العثور علي أي منتجات في قائمة المفضلة.",
    selectImage: "برجاء اختيار صورة!",
    selectImages: "برجاء اختيار صورة واحدة أو أكثر!",
    noReviewsFound: "لم يتم العثور علي أي تقييمات.",
    noReviewFound: "لم يتم العثور علي تقييم بهذا الرقم.",
    onlyOneReview: "عفواً, لا يمكنك كتابة اكثر من تقييم واحد.",
    ratingLessThanOne: "عفوا لا يمكن ان يكون التقييم أقل من واحد.",
    notReviewCreator: "نأسف لكنك لست مالك هذا التقييم. لست مصرح بتنفيذ ذلك الأمر.",
    noUsersFound: "لم يتم العثور علي أي مستخدمين.",
    noDiscountCodeFound: "لم يتم العثور علي كود الخصم.",
    noDiscountCodesFound: "لم يتم العثور علي أكواد الخصم.",
    haveDiscountCode: "لديك حاليا كود خصم, برجاء استخدامه قبل ادخال كود خصم أخر.",
    noUserFoundWithID: "لم يتم العثور علي المستخدم الذي رقمه.",
    notFoundInFavoriteList: "لم يتم العثور علي المنتج في قائمة المفضلة.",
    colorExists: "اللون موجود بالفعل.",
    sizeExists: "الحجم موجود بالفعل.",
    noSizeExists: "الحجم غير موجود.",
    notSeller: "عذراً لكنك لست مالك هذا المنتج, لا يمكنك تنفيذ هذه العملية.",
    noColorExists: "اللون غير موجود.",
    notColorOrSizesRoute: "عذراً هذا ليس الرابط المخصص لتعديل الألوان والأحجام.",
    notInStatusEnum:
      "عذراً ولكن حالة الطلب يجب ان تكون واحدة من الآتي: Not Processed, Processing, Shipped, Delivered, Cancelled.",
    passwordUpdateRoute: "لا يمكنك تحديث كلمة المرور من هنا, برجاء الذهاب إلي المكان المخصص لتغيير كلمة المرور",
    successfulAddProductColor: "تم اضافة اللون بنجاح.",
    successfulAddProductSize: "تم اضافة الحجم بنجاح.",
    successfulDeleteProductColor: "تم حذف اللون بنجاح.",
    successfulDeleteProductSize: "تم حذف الحجم بنجاح.",
    successfulSignUp: "تم إنشاء الحساب بنجاح. برجاء تفعيل البريد الإلكتروني.",
    successfulLogin: "تم تسجيل الدخول بنجاح.",
    successfulLogout: "تم تسجيل الخروج بنجاح.",
    successfulTokenGeneration: "تم إعادة إنشاء الرموز بنجاح.",
    successfulPasswordChange: "تم تغيير كلمة المرور بنجاح.",
    successfulEmailVerification: "تم تفعيل البريد الإلكتروني بنجاح.",
    successfulResetLink: "تم إرسال رابط إعاد تغيير كلمة المرور إلي بريدك الإلكتروني بنجاح.",
    successfulSendVerificationEmail: "تم إرسال رابط تفعيل البريد الإلكتروني لك بنجاح.",
    successfulItemAddToCart: "تم اضافة العنصر إلي سلة المشتريات بنجاح.",
    successfulReduceByOne: "تم إنقاص العنصر من سلة المشتريات بنجاح.",
    successfulIncreaseByOne: "تم زيادة العنصر في سلة المشتريات بنجاح.",
    successfulCartFound: "تم العثور علي سلة المشتريات الخاصة بالمستخدم بنجاح.",
    successfulCartDelete: "تم حذف سلة المشتريات بنجاح.",
    successfulDeleteItemFromCart: "تم حذف المنتج من سلة المشتريات بنجاح.",
    successfulCategoryCreate: "تم إنشاء التصنيف بنجاح.",
    successfulCategoriesFound: "تم العثور علي التصنيفات بنجاح.",
    successfulCategoryFound: "تم العثور علي التصنيف بنجاح.",
    successfulCategoryDetails: "تم تحديث بيانات التصنيف بنجاح.",
    successfulCategoryImage: "تم تحديث صورة التصنيف بنجاح.",
    successfulCategoryDelete: "تم حذف التصنيف بنجاح.",
    successfulOrderCreate: "تم القيام بالطلب بنجاح.",
    successfulOrdersFound: "تم العثور علي الطلبات بنجاح.",
    successfulOrderFound: "تم العثور علي الطلب بنجاح.",
    successfulOrderCancel: "تم إلغاء الطلب بنجاح.",
    successfulFavoriteAdd: "تم إضافة المنتج إلي قائمة المفضلة بنجاح.",
    successfulFavoriteGet: "تم عرض قائمة المفضلة بنجاح.",
    successfulProductsFound: "تم العثور علي المنتجات بنجاح.",
    successfulProductFound: "تم العثور علي المنتج بنجاح.",
    successfulProductCreate: "تم إنشاء منتج جديد بنجاح.",
    successfulProductDetails: "تم تحديث بيانات المنتج بنجاح.",
    successfulProductMainImage: "تم تحديث الصورة الرئيسية للمنتج بنجاح.",
    successfulProductSubImages: "تم تحديث الصور الفرعية للمنتج بنجاح.",
    successfulProductDelete: "تم حذف المنتج بنجاح.",
    successfulReviewCreate: "تم إنشاء التقييم بنجاح.",
    successfulReviewsFound: "تم العثور علي التقييمات بنجاح.",
    successfulReviewFound: "تم العثور علي التقييم بنجاح.",
    successfulReviewUpdate: "تم تحديث التقييم بنجاح.",
    successfulReviewDelete: "تم حذف التقييم بنجاح.",
    successfulUsersFound: "تم العثور علي المستخدمين بنجاح.",
    successfulUserFound: "تم العثور علي المستخدم بنجاح.",
    successfulUserDetails: "تم تحديث بيانات المستخدم بنجاح.",
    successfulUserImage: "تم تحديث صورة المستخدم الشخصية بنجاح.",
    successfulUserDelete: "تم حذف الحساب بنجاح.",
    successfulDeleteYourAccount: "تم حذف حسابك بنجاح.",
    productStatics: "هذه بعض الإحصائيات عن المنتجات.",
    successfulDeleteProductFromFavorite: "تم حذف المنتج من قائمة المفضلة بنجاح.",
    successfulProductFoundInFavorite: "تم العثور علي المنتج في قائمة المفضلة",
    successfulCodeVerification: "تم التأكد من كود الخصم بنجاح.",
    successfulDiscountCodesFound: "تم العثور علي أكواد الخصم بنجاح.",
    successfulCodeGeneration: "تم انشاء كود خصم بنجاح.",
    successfulStatusUpdate: "تم تحديث حالة الطلب بنجاح.",
    discountCodeDeleted: "تم حذف كود الخصم بنجاح.",
    discountCodeCanceled: "تم إلغاء كود الخصم من الطلب بنجاح.",
    successfulGetDiscount: "تم العثور علي الخصم بنجاح.",
  },
};

module.exports = messages;
