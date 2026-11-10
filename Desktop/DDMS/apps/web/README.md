# DDMS frontend

The Next.js application is the DDMS presentation layer. It uses Tailwind CSS
and shadcn/ui and communicates with the NestJS API over REST.

## Local development

1. Copy `.env.example` to `.env.local`.
2. From the repository root, install dependencies with `npm install`.
3. Start the frontend with `npm run dev:web`.

The frontend runs at `http://localhost:3000`. Set
`NEXT_PUBLIC_API_BASE_URL` to the API's base URL; the default is
`http://localhost:4000/api`.

The current page reports API connectivity only. Authentication and document
management interfaces are not yet implemented.
