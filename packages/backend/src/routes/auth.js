'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { User } = require('../models');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);

  // Check if user already exists
  const existing = await User.findOne({ where: { email: data.email } });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const password_hash = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    email: data.email,
    name: data.name,
    password_hash,
  });

  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
  });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await User.findOne({ where: { email: data.email } });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordValid = await bcrypt.compare(data.password, user.password_hash);
  if (!passwordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

module.exports = router;
