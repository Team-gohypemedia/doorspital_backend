const { Validator } = require("node-input-validator");
const PharmacyOrder = require("../model/pharmacy_order_model");
const PharmacyProduct = require("../model/pharmacy_product_model");
const Pharmacy = require("../model/pharmacy_model");

const buildOrderItems = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  const productIds = items.map((item) => item.productId);
  const products = await PharmacyProduct.find({
    _id: { $in: productIds },
    isDeleted: false,
    status: "active",
  });

  const productMap = new Map();
  products.forEach((product) => {
    productMap.set(product._id.toString(), product);
  });

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const { productId } = item;
    const quantity = Number(item.quantity);
    if (!quantity || quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }
    const product = productMap.get(productId);

    if (!product) {
      throw new Error(`Product not available: ${productId}`);
    }

    if (product.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.stock}`
      );
    }

    const price = product.price;
    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url,
      quantity,
      price,
    });
    subtotal += price * quantity;

    product.stock -= quantity;
    await product.save();
  }

  // Get pharmacy from first product (all products should be from same pharmacy for now)
  const firstProduct = products[0];
  const pharmacyId = firstProduct?.pharmacy;

  return { orderItems, subtotal, pharmacyId };
};

const createOrder = async (req, res) => {
  try {
    const validator = new Validator(req.body, {
      "items": "required|array",
      "items.*.productId": "required|string",
      "items.*.quantity": "required|integer|min:1",
      "shippingAddress.fullName": "required",
      "shippingAddress.phone": "required",
      "shippingAddress.addressLine1": "required",
      "shippingAddress.city": "required",
      "shippingAddress.state": "required",
      "shippingAddress.postalCode": "required",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: validator.errors,
      });
    }

    const { orderItems, subtotal, pharmacyId } = await buildOrderItems(req.body.items);

    if (!pharmacyId) {
      return res.status(400).json({
        success: false,
        message: "Products are not associated with a pharmacy",
      });
    }

    const discount = Number(req.body.discount || 0);
    const total = subtotal - discount;

    const order = await PharmacyOrder.create({
      user: req.user._id,
      pharmacy: pharmacyId,
      items: orderItems,
      subtotal,
      discount,
      total,
      paymentMethod: req.body.paymentMethod || "cod",
      paymentStatus: "pending",
      status: "pending",
      shippingAddress: req.body.shippingAddress,
      notes: req.body.notes,
      metadata: req.body.metadata,
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await PharmacyOrder.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch orders" });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await PharmacyOrder.findById(orderId).populate(
      "user",
      "userName email phoneNumber role"
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const isOwner =
      order.user &&
      order.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this order",
      });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch order" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;
    const filter = {};

    // If pharmacy user, only show their orders
    if (req.user.role === "pharmacy") {
      const pharmacy = await Pharmacy.findOne({ user: req.user._id });
      if (!pharmacy) {
        return res.status(400).json({
          success: false,
          message: "Pharmacy profile not found",
        });
      }
      filter.pharmacy = pharmacy._id;
    }

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (numericPage - 1) * numericLimit;

    const [orders, total] = await Promise.all([
      PharmacyOrder.find(filter)
        .populate("user", "userName email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean(),
      PharmacyOrder.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        items: orders,
        pagination: {
          total,
          page: numericPage,
          limit: numericLimit,
          totalPages: Math.ceil(total / numericLimit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch orders" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus } = req.body;

    const order = await PharmacyOrder.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Check authorization
    let canUpdate = req.user?.role === "admin";

    // Pharmacy users can update orders that belong to their pharmacy
    if (!canUpdate && req.user?.role === "pharmacy") {
      const pharmacy = await Pharmacy.findOne({ user: req.user._id });
      if (pharmacy && order.pharmacy &&
        order.pharmacy.toString() === pharmacy._id.toString()) {
        canUpdate = true;
      }
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this order",
      });
    }

    if (status) {
      order.status = status;
    }
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    await order.save();

    return res.json({
      success: true,
      message: "Order updated",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update order" });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
};

