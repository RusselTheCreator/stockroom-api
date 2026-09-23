// =====================================================
// AUTHENTICATION ROUTES
// Handles user registration and login with JWT tokens
// =====================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { isValidEmail, isValidPassword, isRequired, isValidRole } = require('../utils/validation');

// =====================================================
// POST /api/authentication/register
// Creates a new user account
// =====================================================

/**
 * @swagger
 * /api/authentication/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [Admin, User]
 *                 default: User
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post('/register', async (req, res) => {
  try {
    // STEP 1: EXTRACT USER INPUT FROM REQUEST BODY
    const { username, email, password, role = 'User' } = req.body;
    
    // STEP 2: VALIDATE ALL REQUIRED FIELDS
    if (!isRequired(username)) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!isRequired(email)) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!isRequired(password)) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!isValidRole(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be Admin or User.' });
    }
    
    // STEP 3: CHECK IF USERNAME ALREADY EXISTS
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    
    // STEP 4: CHECK IF EMAIL ALREADY EXISTS
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }
    
    // STEP 5: HASH THE PASSWORD FOR SECURE STORAGE
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // STEP 6: INSERT NEW USER INTO DATABASE
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, role, is_active, created_at`,
      [username, email, passwordHash, role]
    );
    
    const newUser = result.rows[0];
    
    // STEP 7: RETURN SUCCESS RESPONSE WITH USER DATA (NO PASSWORD)
    return res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// =====================================================
// POST /api/authentication/login
// Authenticates user and returns JWT token
// =====================================================

/**
 * @swagger
 * /api/authentication/login:
 *   post:
 *     summary: Login and receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 *       401:
 *         description: Account inactive
 */
router.post('/login', async (req, res) => {
  try {
    // STEP 1: EXTRACT CREDENTIALS FROM REQUEST BODY
    const { username, password } = req.body;
    
    // STEP 2: VALIDATE REQUIRED FIELDS
    if (!isRequired(username)) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!isRequired(password)) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    
    // STEP 3: FIND USER BY USERNAME
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = $1',
      [username]
    );
    
    // STEP 4: CHECK IF USER EXISTS
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    
    const user = result.rows[0];
    
    // STEP 5: CHECK IF ACCOUNT IS ACTIVE
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive. Please contact administrator.' });
    }
    
    // STEP 6: VERIFY PASSWORD USING BCRYPT
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    
    // STEP 7: CREATE JWT PAYLOAD WITH USER INFO
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    // STEP 8: SIGN JWT TOKEN WITH SECRET AND EXPIRATION
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    // STEP 9: RETURN SUCCESS WITH USER INFO AND TOKEN
    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      jwtToken: token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

module.exports = router;
