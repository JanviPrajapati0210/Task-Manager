const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Set environment configuration for automated CI testing
process.env.JWT_SECRET = process.env.JWT_SECRET || "ci_test_jwt_secret_key_98765";
process.env.NODE_ENV = "test";
process.env.PORT = "5099";

// Mock Mongoose models to allow isolated API testing without a live MongoDB connection
const Task = require("../models/Task");
const User = require("../models/User");
const app = require("../server");

// Generate mock JWT token for authenticated requests
const testUserId = new mongoose.Types.ObjectId().toString();
const validToken = jwt.sign(
  { id: testUserId, email: "test@example.com", role: "user" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Task Management API - CI/CD Automated Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock user for requireAuth middleware
    jest.spyOn(User, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: testUserId,
        email: "test@example.com",
        username: "testuser",
        role: "user",
      }),
    });
  });

  afterAll(async () => {
    try {
      await mongoose.connection.close();
    } catch (_) {
      // ignore
    }
  });

  describe("GET /tasks (Authentication Guard)", () => {
    it("should return HTTP 401 Unauthorized when no JWT token is provided", async () => {
      const res = await request(app).get("/tasks");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });
  });

  describe("GET /tasks (Retrieve All Tasks)", () => {
    it("should return HTTP 200 and a list of tasks for authenticated user", async () => {
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          title: "Sample Task",
          status: "pending",
          priority: "medium",
          user: { username: "testuser", email: "test@example.com", role: "user" },
        },
      ];

      jest.spyOn(Task, "find").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockTasks),
        }),
      });

      const res = await request(app)
        .get("/tasks")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /tasks (Create Task)", () => {
    it("should return HTTP 201 Created when a valid task payload is submitted", async () => {
      const mockTask = {
        _id: new mongoose.Types.ObjectId().toString(),
        title: "New CI/CD Task",
        description: "Task created during automated CI test",
        priority: "high",
        status: "pending",
        user: { username: "testuser", email: "test@example.com", role: "user" },
        populate: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Task, "create").mockResolvedValue(mockTask);

      const res = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          title: "New CI/CD Task",
          description: "Task created during automated CI test",
          priority: "high",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Task Created Successfully");
    });

    it("should return HTTP 400 Bad Request when title is missing", async () => {
      const res = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          description: "Task without title",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
    });
  });

  describe("GET /tasks/:id (Retrieve Task By ID)", () => {
    it("should return HTTP 200 and the requested task", async () => {
      const taskId = new mongoose.Types.ObjectId().toString();
      const mockTask = {
        _id: taskId,
        title: "Existing Task",
        status: "in-progress",
        priority: "medium",
        user: { username: "testuser", email: "test@example.com", role: "user" },
      };

      jest.spyOn(Task, "findOne").mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTask),
      });

      const res = await request(app)
        .get(`/tasks/${taskId}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(taskId);
    });
  });

  describe("GET /auth/google/client-id (Public Configuration Endpoint)", () => {
    it("should return HTTP 200 with google client configuration status", async () => {
      const res = await request(app).get("/auth/google/client-id");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clientId");
    });
  });
});
