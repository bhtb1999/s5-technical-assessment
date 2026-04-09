"use strict";

require("dotenv").config();
const request = require("supertest");
const app = require("../app");
const { sequelize } = require("../models");

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.drop();
  await sequelize.close();
});

describe("POST /auth/register", () => {
  it("should register a new user and return 201 with user data", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "test@example.com",
      name: "Test User",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.created_at).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("should return 409 when registering with a duplicate email", async () => {
    await request(app).post("/auth/register").send({
      email: "duplicate@example.com",
      name: "First User",
      password: "password123",
    });

    const res = await request(app).post("/auth/register").send({
      email: "duplicate@example.com",
      name: "Second User",
      password: "password456",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it("should return 400 when email is invalid", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "not-an-email",
      name: "Bad User",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should return 400 when password is too short", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "short@example.com",
      name: "Short Pass",
      password: "123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should return 400 when required fields are missing", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "missing@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe("POST /auth/login", () => {
  const credentials = {
    email: "login-test@example.com",
    name: "Login User",
    password: "securePassword99",
  };

  beforeAll(async () => {
    await request(app).post("/auth/register").send(credentials);
  });

  it("should return 200 with a JWT token on valid credentials", async () => {
    const res = await request(app).post("/auth/login").send({
      email: credentials.email,
      password: credentials.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.name).toBe(credentials.name);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("should return 401 on wrong password", async () => {
    const res = await request(app).post("/auth/login").send({
      email: credentials.email,
      password: "wrongPassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("should return 401 on non-existent email", async () => {
    const res = await request(app).post("/auth/login").send({
      email: "nobody@example.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("should return 400 when body is empty", async () => {
    const res = await request(app).post("/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
