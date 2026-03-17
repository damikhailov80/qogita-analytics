import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">Welcome to Qogita</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          Product catalog management system
        </p>
        <Link
          href="/products"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          View Products
        </Link>
      </div>
    </div>
  );
}
