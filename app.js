const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: true,
  },
});

// Test database connection
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful");
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

    // Create schools table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if table is empty and add sample data if needed
    const [rows] = await connection.query(
      "SELECT COUNT(*) as count FROM schools"
    );
    if (rows[0].count === 0) {
      // Add sample data
      await connection.query(`
        INSERT INTO schools (name, address, latitude, longitude) VALUES
        ('Washington High School', '1234 Washington St, Seattle, WA', 47.6062, -122.3321),
        ('Lincoln Elementary', '5678 Lincoln Ave, Portland, OR', 45.5152, -122.6784),
        ('Jefferson Middle School', '9012 Jefferson Blvd, San Francisco, CA', 37.7749, -122.4194),
        ('Roosevelt Academy', '3456 Roosevelt Way, Los Angeles, CA', 34.0522, -118.2437),
        ('Kennedy High', '7890 Kennedy Rd, San Diego, CA', 32.7157, -117.1611)
      `);
    }

    console.log("Database initialized successfully");
    connection.release();
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}
// Calculate the distance between two geographical coordinates using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

// Validate school data
function validateSchoolData(data) {
  const errors = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    errors.push("Name is required and must be a non-empty string");
  }

  if (
    !data.address ||
    typeof data.address !== "string" ||
    data.address.trim() === ""
  ) {
    errors.push("Address is required and must be a non-empty string");
  }

  if (data.latitude === undefined || isNaN(parseFloat(data.latitude))) {
    errors.push("Latitude is required and must be a valid number");
  } else {
    const lat = parseFloat(data.latitude);
    if (lat < -90 || lat > 90) {
      errors.push("Latitude must be between -90 and 90 degrees");
    }
  }

  if (data.longitude === undefined || isNaN(parseFloat(data.longitude))) {
    errors.push("Longitude is required and must be a valid number");
  } else {
    const lon = parseFloat(data.longitude);
    if (lon < -180 || lon > 180) {
      errors.push("Longitude must be between -180 and 180 degrees");
    }
  }

  return errors;
}

// API Routes

// Add School API
app.post("/addSchool", async (req, res) => {
  try {
    const schoolData = {
      name: req.body.name,
      address: req.body.address,
      latitude: parseFloat(req.body.latitude),
      longitude: parseFloat(req.body.longitude),
    };

    // Validate input data
    const validationErrors = validateSchoolData(schoolData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors,
      });
    }

    // Insert school into database
    const [result] = await pool.query(
      "INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)",
      [
        schoolData.name,
        schoolData.address,
        schoolData.latitude,
        schoolData.longitude,
      ]
    );

    res.status(201).json({
      success: true,
      message: "School added successfully",
      schoolId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding school:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while adding the school",
    });
  }
});

// List Schools API
app.get("/listSchools", async (req, res) => {
  try {
    // Get user's coordinates from query parameters
    const userLatitude = parseFloat(req.query.latitude);
    const userLongitude = parseFloat(req.query.longitude);

    // Validate coordinates
    if (
      isNaN(userLatitude) ||
      isNaN(userLongitude) ||
      userLatitude < -90 ||
      userLatitude > 90 ||
      userLongitude < -180 ||
      userLongitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180",
      });
    }

    // Fetch all schools from database
    const [schools] = await pool.query("SELECT * FROM schools");

    // Calculate distance for each school and sort by proximity
    const schoolsWithDistance = schools.map((school) => {
      const distance = calculateDistance(
        userLatitude,
        userLongitude,
        school.latitude,
        school.longitude
      );

      return {
        ...school,
        distance: parseFloat(distance.toFixed(2)), // Distance in kilometers, rounded to 2 decimal places
      };
    });

    // Sort schools by distance (closest first)
    schoolsWithDistance.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      count: schoolsWithDistance.length,
      schools: schoolsWithDistance,
    });
  } catch (error) {
    console.error("Error listing schools:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving schools",
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "School Management API",
    endpoints: [
      {
        path: "/addSchool",
        method: "POST",
        description: "Add a new school",
        payload: {
          name: "string (required)",
          address: "string (required)",
          latitude: "number (required, between -90 and 90)",
          longitude: "number (required, between -180 and 180)",
        },
      },
      {
        path: "/listSchools",
        method: "GET",
        description:
          "List all schools sorted by proximity to specified location",
        parameters: {
          latitude: "number (required, between -90 and 90)",
          longitude: "number (required, between -180 and 180)",
        },
      },
    ],
  });
});

// Start the server
async function startServer() {
  await testDBConnection();
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

module.exports = app; // For testing purposes
