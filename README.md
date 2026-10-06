# Task Manager

Full-stack Task Management app.

- **Backend:** Node.js + Express + MongoDB (Mongoose), JWT authentication, bcrypt password hashing
- **Frontend:** React + Vite app in [`client/`](client/) (login/register, task CRUD, filters, chart)

## Features

- Register / login with hashed passwords; JWT issued on login (`Authorization: Bearer <token>`)
- All `/tasks` routes are protected by auth middleware; `GET /auth/me` returns the current user
- Task fields: `title`, `description`, `status` (`pending` | `in-progress` | `completed`),
  `priority` (`low` | `medium` | `high`), `completed`, `createdAt`
- Global request logger (console + `logs/server.log`), global error handler (last in the pipeline)
- Validation middleware: Content-Type check, `:id` format check, task body check
- React client with optimistic updates, toasts, status/priority filters, and a task chart
- **Practical 8:** route-based code splitting, lazy-loaded chart, memoised task rows
  (see [`docs/PRACTICAL8.md`](docs/PRACTICAL8.md))

## Project structure

```
Task-Manager/
├── server.js                    # app setup + middleware pipeline order
├── .env                         # PORT, MONGO_URI, JWT_SECRET (not committed)
├── routes/                      # auth.js, tasks.js
├── controllers/                 # authController.js, taskController.js
├── middleware/                  # logger, auth, validate*, notFound, errorHandler
├── models/                      # User.js, Task.js
├── public/                      # original Practical 4 vanilla UI (predates auth, see note)
├── data/, logs/
├── docs/PRACTICAL8.md
└── client/                      # React frontend (Vite)
    └── src/ {pages, components, utils, api.js}
```

## Setup

### 1. Backend
```bash
npm install
# .env needs: PORT=5000, MONGO_URI=<your mongo uri>, JWT_SECRET=<any long random string>
npm start
```
API runs on `http://localhost:5000`.

### 2. React client
```bash
cd client
npm install
npm run dev        # http://localhost:5173
```
The client calls `http://localhost:5000` by default. To change it, copy `client/.env.example`
to `client/.env` and edit `VITE_API_URL`.

Production build: `cd client && npm run build` (chunk sizes are printed in the terminal).

## Endpoints

### Auth
| Method | Route            | Body                        | Success | Errors   | Notes                      |
|--------|------------------|-----------------------------|---------|----------|----------------------------|
| POST   | /auth/register   | `{ email, password }`       | 201     | 400, 409 | password is hashed         |
| POST   | /auth/login      | `{ email, password }`       | 200     | 400, 401 | returns `{ token }`        |
| GET    | /auth/me         | –                           | 200     | 401      | requires Bearer token      |

### Tasks (all require `Authorization: Bearer <token>`)
| Method | Route       | Body                                                       | Success | Errors        |
|--------|-------------|------------------------------------------------------------|---------|---------------|
| GET    | /tasks      | –                                                          | 200     | 401           |
| GET    | /tasks/:id  | –                                                          | 200     | 400, 401, 404 |
| POST   | /tasks      | `{ title, description?, status?, priority? }`              | 201     | 400, 401      |
| PUT    | /tasks/:id  | any of `title, description, status, priority, completed`   | 200     | 400, 401, 404 |
| DELETE | /tasks/:id  | –                                                          | 200     | 400, 401, 404 |

## Testing with curl

```bash
# register + login
curl -X POST http://localhost:5000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret123"}'
curl -X POST http://localhost:5000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret123"}'

# use the returned token
curl http://localhost:5000/tasks -H "Authorization: Bearer <token>"
curl -X POST http://localhost:5000/tasks -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"title":"Write README","priority":"high"}'
```

## Note on `public/`
`public/` is the original Practical 4 UI served at `http://localhost:5000/`. It was written before
authentication was added and sends no token, so its `/tasks` calls now return 401. Use the React
client in `client/` instead.

## Key design decisions (for viva)

- **`app.use(express.json())` before routes** – otherwise `req.body` is `undefined` on POST/PUT.
- **Error handler registered last, with 4 params** `(err, req, res, next)` – Express only treats a function as an error handler if it has exactly 4 arguments, and it can only catch errors from middleware/routes registered *before* it.
- **Every middleware calls `next()`** unless it ends the response – otherwise the request hangs forever.
- **Stack traces are never sent to the client** – `errorHandler.js` logs `err.stack` server-side only, and returns a generic message to the client. Leaking a stack trace exposes file paths and library versions, which is an information-disclosure risk.
- **`app.use()` vs route-specific middleware** – `app.use(fn)` runs on every request; passing `fn` as an extra argument to `router.get('/path', fn, handler)` scopes it to just that route (e.g. `validateTaskId` only runs on routes with `:id`).
- **Passwords are hashed with bcrypt, never stored in plain text**; login returns a signed JWT, and `requireAuth` rejects missing, invalid or expired tokens with 401.