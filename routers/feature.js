const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { name, note, price } = req.body;

  try {
    // Create a new Feature
    const newFeature = await prisma.feature.create({
      data: {
        name,
        note,
        price: parseFloat(price) || 0, // Ensure the price is a number
      },
    });

    res.status(201).json(newFeature);
  } catch (error) {
    console.error("Error creating feature:", error);

    // Handle unique constraint violation (if name is unique)
    if (
      error.code === "P2002" &&
      error.meta &&
      error.meta.target.includes("name")
    ) {
      res
        .status(400)
        .json({ message: "Feature with this name already exists." });
    } else {
      res.status(500).json({ message: "Error creating feature" });
    }
  }
});

// Endpoint to active feature
router.put("/active-feature", async (req, res) => {
  const { subscriptionId, featureId } = req.params;

  try {
    // Retrieve the feature by its ID
    const feature = await prisma.feature.findUnique({
      where: {
        id: parseInt(featureId),
      },
    });

    if (!feature) {
      return res.status(404).json({ message: "Feature not found" });
    }

    // Retrieve the subscription by its ID
    const subscription = await prisma.subscription.findUnique({
      where: {
        id: parseInt(subscriptionId),
      },
    });

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    // Add the feature ID to the subscription's features array
    const updatedFeatures = subscription.features
      ? [...subscription.features, feature]
      : [feature];

    // Update the subscription with the new features array
    const updatedSubscription = await prisma.subscription.update({
      where: {
        id: parseInt(subscriptionId),
      },
      data: {
        features: updatedFeatures,
      },
    });

    res.json(updatedSubscription);
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({ message: "Error updating subscription" });
  }
});

module.exports = router;
