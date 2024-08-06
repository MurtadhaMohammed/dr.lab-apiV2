const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/adminAuth");
const dayjs = require("dayjs");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/add-feature", async (req, res) => {
  const { name, note ,price} = req.body;

  try {
    // Create a new Feature
    const newFeature = await prisma.feature.create({
      data: {
        name,
        note,
        price,
      },
    });

    res.status(200).json(newFeature);
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

router.get("/features", async (req, res) => {
  try {
    // Retrieve all features
    const features = await prisma.feature.findMany();

    res.json(features);
  } catch (error) {
    console.error("Error retrieving features:", error);
    res.status(500).json({ message: "Error retrieving features" });
  }
});


// Endpoint to active feature
router.put("/active-feature", async (req, res) => {
  const { subscriptionId, featureId, price, startDate, endDate } = req.body;

  try {
    // Retrieve the feature by its ID
    let feature = await prisma.feature.findUnique({
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
    feature = { ...feature, startDate, endDate, price };
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
