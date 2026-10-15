# Divinity to your door

Religious bookshop. Live stock, a basket, and a demonstration checkout (test cards are never charged).

## Free hosting

1. Create a free Postgres database at [Neon](https://neon.tech) and copy the connection string.
2. Import this repo into [Vercel](https://vercel.com).
3. Set the environment variable `DATABASE_URL` to that connection string.
4. Also set `VITE_AUTH_ENABLED` to `false`.
5. Deploy. The build applies the catalog and stock tables.

Without `DATABASE_URL`, stock and orders stay in the project's private Vercel Blob store, so a new server still sees the same shelf. Set `DATABASE_URL` to use Postgres instead.
