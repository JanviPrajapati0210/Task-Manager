# Task Manager API

A RESTful backend for a Task Management system, built with Node.js and Express as part of **ITUE301 – Advanced Web Development Frameworks, Practical 4**.

## Features

- Full CRUD on `/tasks` (in-memory storage, no DB yet)
- Global request-logging middleware (method, URL, timestamp)
- Global error-handling middleware (last in the pipeline)
- Correct HTTP status codes (200, 201, 400, 404, 500)
- Supplementary middleware:
  - Rejects POST/PUT requests without `Content-Type: application/json`
  - Validates `:id` format before it reaches the controller
  - Structured JSON 404 handler for undefined routes

## Project structure

```
task-manager-api/
├── server.js                    # app setup + middleware pipeline order
├── routes/tasks.js              # route → middleware → controller wiring
├── controllers/taskController.js
├── middleware/
│   ├── logger.js                # global request logger
│   ├── errorHandler.js          # global error handler (must be last)
│   ├── notFound.js              # 404 handler
│   ├── validateContentType.js   # supplementary
│   └── validateTaskId.js        # supplementary
└── data/taskStore.js            # in-memory "database"
```

## Setup

```bash
npm install
npm start        # or: node server.js
```

Server runs on `http://localhost:5000`.

## Endpoints

| Method | Route       | Body                                | Success | Notes                        |
|--------|-------------|--------------------------------------|---------|-------------------------------|
| GET    | /tasks      | –                                     | 200     | List all tasks                |
| GET    | /tasks/:id  | –                                     | 200     | Get one task                  |
| POST   | /tasks      | `{ "title": "string" }`               | 201     | Requires JSON Content-Type    |
| PUT    | /tasks/:id  | `{ "title"?, "completed"? }`          | 200     | Requires JSON Content-Type    |
| DELETE | /tasks/:id  | –                                     | 200     | Deletes the task              |

## Testing with curl

```bash
curl http://localhost:5000/tasks

curl -X POST http://localhost:5000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Write README"}'

curl -X PUT http://localhost:5000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

curl -X DELETE http://localhost:5000/tasks/1
```

Or import into Postman/Thunder Client and hit the same routes.

## Key design decisions (for viva)

- **`app.use(express.json())` before routes** – otherwise `req.body` is `undefined` on POST/PUT.
- **Error handler registered last, with 4 params** `(err, req, res, next)` – Express only treats a function as an error handler if it has exactly 4 arguments, and it can only catch errors from middleware/routes registered *before* it.
- **Every middleware calls `next()`** unless it ends the response – otherwise the request hangs forever.
- **Stack traces are never sent to the client** – `errorHandler.js` logs `err.stack` server-side only, and returns a generic message to the client. Leaking a stack trace exposes file paths and library versions, which is an information-disclosure risk.
- **`app.use()` vs route-specific middleware** – `app.use(fn)` runs on every request; passing `fn` as an extra argument to `router.get('/path', fn, handler)` scopes it to just that route (e.g. `validateTaskId` only runs on routes with `:id`).
