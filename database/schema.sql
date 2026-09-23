-- =====================================================
-- STOCKROOM DATABASE SCHEMA
-- Production-ready inventory management system
-- =====================================================

-- DROP TABLES IF EXIST (for clean setup)
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stock_levels CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE
-- Stores user accounts with authentication details
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'User',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('Admin', 'User'))
);

-- =====================================================
-- SUPPLIERS TABLE
-- Contact information for product suppliers
-- =====================================================
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- PRODUCTS TABLE
-- Master product catalog with pricing and reorder info
-- =====================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- WAREHOUSES TABLE
-- Physical warehouse locations
-- =====================================================
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- STOCK_LEVELS TABLE
-- Current inventory quantities at each warehouse
-- Each product-warehouse pair has exactly one record
-- =====================================================
CREATE TABLE stock_levels (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    UNIQUE (product_id, warehouse_id),
    CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

-- =====================================================
-- STOCK_MOVEMENTS TABLE
-- Append-only audit log of all inventory changes
-- Types: receive (incoming), issue (outgoing), adjust (correction)
-- =====================================================
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_movement_type CHECK (movement_type IN ('receive', 'issue', 'adjust'))
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);

-- =====================================================
-- SEED DATA (Optional - for development/testing)
-- =====================================================
-- Admin user with password: admin123
-- User with password: user123
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@stockroom.local', '$2a$10$CN8oOrIjAP2/i349pCnTpO7Dk9vxReP7uKWfjXbEv4Kc3MoesFwzm', 'Admin'),
('user', 'user@stockroom.local', '$2a$10$o9leyl2JP.9ju1WtzAi04emAFAQsdb2sJzbFCC1y7FfHE.y1IVv3q', 'User');

-- Sample suppliers
INSERT INTO suppliers (name, email, phone, address, created_by) VALUES
('TechParts Inc', 'sales@techparts.com', '+1-555-0100', '123 Industrial Blvd, Tech City, CA 94000', 1),
('Global Components', 'orders@globalcomp.com', '+1-555-0200', '456 Supply Lane, Component City, NY 10001', 1);

-- Sample products
INSERT INTO products (sku, name, description, unit, unit_price, reorder_level, supplier_id, created_by) VALUES
('WIDGET-001', 'Standard Widget', 'High-quality standard widget for general use', 'piece', 12.50, 100, 1, 1),
('GADGET-001', 'Premium Gadget', 'Premium electronic gadget with warranty', 'piece', 45.99, 50, 2, 1),
('PART-123', 'Replacement Part', 'Universal replacement part', 'piece', 8.75, 200, 1, 1);

-- Sample warehouses
INSERT INTO warehouses (name, location, created_by) VALUES
('Main Warehouse', 'Building A, 789 Storage Way, Warehouse City, TX 75001', 1),
('Distribution Center', 'Building B, 321 Logistics Drive, Shipping City, FL 33001', 1);

-- Initial stock levels
INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_by) VALUES
(1, 1, 150, 1),
(1, 2, 80, 1),
(2, 1, 75, 1),
(2, 2, 30, 1),
(3, 1, 250, 1);

-- Initial stock movements
INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reason, user_id) VALUES
(1, 1, 'receive', 150, 'Initial stock', 1),
(1, 2, 'receive', 80, 'Initial stock', 1),
(2, 1, 'receive', 75, 'Initial stock', 1),
(2, 2, 'receive', 30, 'Initial stock', 1),
(3, 1, 'receive', 250, 'Initial stock', 1);

-- =====================================================
-- END OF SCHEMA
-- =====================================================
