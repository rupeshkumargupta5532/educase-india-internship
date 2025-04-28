-- File: database_setup.sql
-- Create the database (if not using an existing one)
CREATE DATABASE IF NOT EXISTS school_management;
USE school_management;

-- Create the schools table
CREATE TABLE IF NOT EXISTS schools (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data (optional)
INSERT INTO schools (name, address, latitude, longitude) VALUES
('Washington High School', '1234 Washington St, Seattle, WA', 47.6062, -122.3321),
('Lincoln Elementary', '5678 Lincoln Ave, Portland, OR', 45.5152, -122.6784),
('Jefferson Middle School', '9012 Jefferson Blvd, San Francisco, CA', 37.7749, -122.4194),
('Roosevelt Academy', '3456 Roosevelt Way, Los Angeles, CA', 34.0522, -118.2437),
('Kennedy High', '7890 Kennedy Rd, San Diego, CA', 32.7157, -117.1611);