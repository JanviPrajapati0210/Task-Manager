# Task Manager API

A RESTful backend for a Task Management system, built with Node.js and Express.

## Features

- Full CRUD on `/tasks`, persisted to `data/tasks.json` (survives restarts)
- Simple frontend UI at `http://localhost:5000/` (`public/`) for adding, updating, deleting, and refreshing tasks without Postman
- Global request-logging middleware — logs method, URL, timestamp, IP to both the console **and** `logs/server.log`
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
├── public/                      # frontend UI (index.html, style.css, script.js)
├── routes/tasks.js              # route → middleware → controller wiring
├── controllers/taskController.js
├── middleware/
│   ├── logger.js                # global request logger (console + logs/server.log)
│   ├── errorHandler.js          # global error handler (must be last)
│   ├── notFound.js              # 404 handler
│   ├── validateContentType.js   # supplementary
│   └── validateTaskId.js        # supplementary
├── data/
│   ├── taskStore.js             # data-access layer
│   └── tasks.json               # persisted task data (auto-created on first run)
└── logs/
    └── server.log                # request log (auto-created on first run)
```

## Setup

```bash
npm install
npm start        # or: node server.js
```

Server runs on `http://localhost:5000`. Open that URL in a browser for the UI, or hit `/tasks` directly for the raw API.

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
