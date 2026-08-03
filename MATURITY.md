# Richardson Maturity Model – Evaluation of the Task Manager API

This document evaluates the Task Manager API  against the Richardson Maturity Model.

## 1. Evaluation Table

| Level | Criterion                                                        | Does our API satisfy this? | Evidence |
|-------|-------------------------------------------------------------------|-----------------------------|----------|
| **0** | Single URI, single HTTP method (typically POST), used like an RPC endpoint (e.g. everything through `/api`) | N/A — we're already past this | We expose multiple resource-specific URIs (`/tasks`, `/tasks/:id`), not one catch-all endpoint. |
| **1** | Resources — distinct URIs for distinct resources, instead of one giant endpoint | ✅ Yes | `/tasks` (collection) and `/tasks/:id` (single item) are separate, resource-named URIs. There's no `/doStuff?action=...` style endpoint. |
| **2** | Correct HTTP verbs + meaningful status codes for each operation | ✅ Yes | `GET /tasks` → 200, `GET /tasks/:id` → 200/404, `POST /tasks` → 201/400, `PUT /tasks/:id` → 200/400/404, `DELETE /tasks/:id` → 200/404. Verbs map to CRUD operations correctly instead of using GET/POST for everything. |
| **3** | HATEOAS — response bodies include hyperlinks describing available actions/related resources | ❌ Not implemented | Current responses return plain task objects with no `_links` field. See HATEOAS section below for what we *would* add. |

**Conclusion: the API currently satisfies Level 2** of the Richardson Maturity Model.

### Justification

- **Level 0 → Level 1 satisfied:** Instead of a single tunnel endpoint, the API exposes resources as nouns in the URL (`/tasks`, `/tasks/:id`), which is the defining trait of Level 1.
- **Level 1 → Level 2 satisfied:** Every operation uses the semantically correct HTTP verb (GET for reads, POST for creation, PUT for updates, DELETE for removal), and every response carries a status code that actually reflects the outcome — `201` on creation, `404` when a task doesn't exist, `400` on bad input, `500` only for unexpected server errors. This was verified by testing each endpoint with Postman/Thunder Client (see Practical 4 README).
- **Level 2 → Level 3 not yet satisfied:** None of the JSON responses currently include a `_links` object, so a client has no way to discover related actions from the response body alone — it has to know the URL scheme in advance. That's what Level 3 (HATEOAS) would add.

## 2. HATEOAS Awareness (Level 3)

If we were targeting Level 3, each task response would include a `_links` object
so a client could discover available actions without hardcoding URLs. Example
for a single task response:

\`\`\`json
{
  "id": "123",
  "title": "Task A",
  "completed": false,
  "_links": {
    "self":   { "href": "/tasks/123", "method": "GET" },
    "update": { "href": "/tasks/123", "method": "PUT" },
    "delete": { "href": "/tasks/123", "method": "DELETE" }
  }
}
\`\`\`

The two most essential links to add would be:

1. **`self`** — the canonical URL of the resource itself, so a client can always re-fetch or bookmark it without reconstructing the path.
2. **`delete`** (or `update`) — points the client to the next legal action it can take on this resource, which is the whole point of HATEOAS: the API tells the client what it *can do next*, instead of the client needing out-of-band documentation.

No code implementation was required for this section per the assignment brief — awareness-level credit only.

## 3. Why Most Production APIs Stop at Level 2

In practice, the vast majority of production REST APIs (GitHub's API, Stripe's
API, Twitter's API, etc.) stop at Level 2 and never fully adopt Level 3/HATEOAS,
for a few practical reasons:

- **Client complexity.** Level 3 assumes clients dynamically follow links from
  responses rather than hardcoding routes. In reality, most frontend/mobile
  clients are built against fixed API documentation anyway (Swagger/OpenAPI,
  Postman collections), so the "self-discovery" benefit of HATEOAS is rarely
  used even when it's available.
- **Payload overhead.** Adding `_links` to every response increases payload
  size on every single call, which matters at scale, for marginal real-world
  benefit when clients aren't actually parsing those links to navigate.
- **Tooling and ecosystem mismatch.** Most API tooling (OpenAPI/Swagger, ORMs,
  auto-generated SDKs) is built around fixed, documented endpoints rather than
  runtime link discovery, so HATEOAS doesn't fit naturally into how teams
  already design, document, and consume APIs.
- **Diminishing returns.** Levels 1 and 2 already deliver the practical
  benefits developers care about most — predictable URLs, correct verbs, and
  meaningful status codes make an API easy to reason about and debug. Level 3's
  extra benefit (runtime discoverability) matters most for large, evolving
  public API ecosystems, not typical internal or product APIs like this one.

As a result, "Level 2" has become the de facto industry standard for what
people mean when they say an API is "RESTful," even though the Richardson
Maturity Model technically defines a Level 3 above it.