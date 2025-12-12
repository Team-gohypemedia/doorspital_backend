const { Validator } = require("node-input-validator");
const PharmacyProduct = require("../model/pharmacy_product_model");
const Pharmacy = require("../model/pharmacy_model");

const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) { }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const mapUploadedImages = (files = []) =>
  files.map((file) => ({
    url: `/uploads/pharmacy-products/${file.filename}`,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
  }));

const createProduct = async (req, res) => {
  try {
    const validator = new Validator(req.body, {
      name: "required",
      price: "required|numeric",
      stock: "integer",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: validator.errors,
      });
    }

    const {
      name,
      sku,
      description,
      category,
      brand,
      price,
      mrp,
      discountPercent,
      stock,
      dosageForm,
      strength,
      tags,
      expiry,
      isPrescriptionRequired,
    } = req.body;

    if (sku) {
      const existing = await PharmacyProduct.findOne({ sku });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    const images = mapUploadedImages(req.files);

    // Get pharmacy for current user
    const pharmacy = await Pharmacy.findOne({ user: req.user._id });
    if (!pharmacy) {
      return res.status(400).json({
        success: false,
        message: "Pharmacy profile not found. Please complete your pharmacy registration first.",
      });
    }

    const product = await PharmacyProduct.create({
      name,
      sku,
      description,
      category,
      brand,
      price: Number(price),
      mrp: mrp ? Number(mrp) : undefined,
      discountPercent: discountPercent ? Number(discountPercent) : undefined,
      stock: stock ? Number(stock) : 0,
      dosageForm,
      strength,
      expiry: typeof expiry === "string" ? expiry.trim() : expiry,
      tags: parseArrayField(tags),
      images,
      isPrescriptionRequired:
        typeof isPrescriptionRequired === "boolean"
          ? isPrescriptionRequired
          : isPrescriptionRequired === "true",
      pharmacy: pharmacy._id,
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create product" });
  }
};

const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      isPrescriptionRequired,
      minPrice,
      maxPrice,
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { isDeleted: false };

    if (category) {
      filter.category = new RegExp(category, "i");
    }

    if (status) {
      if (status !== "all") {
        filter.status = status;
      }
    } else {
      filter.status = "active";
    }

    if (typeof isPrescriptionRequired !== "undefined") {
      filter.isPrescriptionRequired = isPrescriptionRequired === "true";
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (numericPage - 1) * numericLimit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [items, total] = await Promise.all([
      PharmacyProduct.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(numericLimit)
        .lean(),
      PharmacyProduct.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page: numericPage,
          limit: numericLimit,
          totalPages: Math.ceil(total / numericLimit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch products" });
  }
};

const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await PharmacyProduct.findOne({
      _id: productId,
      isDeleted: false,
    }).lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch product" });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await PharmacyProduct.findById(productId);

    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const updatableFields = [
      "name",
      "sku",
      "description",
      "category",
      "brand",
      "price",
      "mrp",
      "discountPercent",
      "stock",
      "dosageForm",
      "strength",
      "expiry",
      "tags",
      "status",
      "isPrescriptionRequired",
    ];

    updatableFields.forEach((field) => {
      if (typeof req.body[field] !== "undefined") {
        if (["price", "mrp", "discountPercent", "stock"].includes(field)) {
          product[field] = Number(req.body[field]);
        } else if (field === "tags") {
          product.tags = parseArrayField(req.body.tags);
        } else if (field === "isPrescriptionRequired") {
          product.isPrescriptionRequired =
            typeof req.body[field] === "boolean"
              ? req.body[field]
              : req.body[field] === "true";
        } else if (field === "expiry") {
          product.expiry =
            typeof req.body.expiry === "string"
              ? req.body.expiry.trim()
              : req.body.expiry;
        } else {
          product[field] = req.body[field];
        }
      }
    });

    if (req.body.removeImageFilenames) {
      const removeList = parseArrayField(req.body.removeImageFilenames);
      if (removeList.length) {
        product.images = product.images.filter(
          (img) => !removeList.includes(img.filename)
        );
      }
    }

    if (req.files?.length) {
      product.images.push(...mapUploadedImages(req.files));
    }

    await product.save();

    return res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update product" });
  }
};

const archiveProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await PharmacyProduct.findById(productId);

    if (!product || product.isDeleted) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.isDeleted = true;
    product.status = "inactive";
    await product.save();

    return res.json({
      success: true,
      message: "Product archived",
    });
  } catch (error) {
    console.error("Error archiving product:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to archive product" });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
};

