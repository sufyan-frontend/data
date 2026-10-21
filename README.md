This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Finead Communication API

Data for the Finead website lives in the same GitHub data repo under `finead/`
(see `src/lib/finead-store.ts`). Collections: `enquiries`, `projects`, `jobs`, `team`.

| Method | Route | Auth |
| --- | --- | --- |
| GET | `/api/finead/:collection` | public for projects, jobs, team (active items only); enquiries need the secret |
| GET | `/api/finead/:collection?all=1` | `x-cms-secret`, includes hidden items |
| POST | `/api/finead/:collection` | `x-cms-secret`, JSON or multipart with an `image` file |
| PATCH | `/api/finead/:collection/:id` | `x-cms-secret`, only the fields sent change |
| DELETE | `/api/finead/:collection/:id` | `x-cms-secret`, also removes the uploaded image |
| POST | `/api/finead/:collection/reorder` | `x-cms-secret`, body `{ "ids": [...] }` |

No new env vars: it reuses `GITHUB_*` and `CMS_SECRET`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
