import { useState } from "react";
import type { Book } from "@/lib/catalog";

export function CoverArt({
  book,
  priority = false,
}: {
  book: Book;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full min-h-full w-full flex-col justify-between bg-ink p-4 text-paper">
        <span className="text-xs tracking-widest text-sand uppercase">{book.tradition}</span>
        <span className="font-display text-2xl">{book.title}</span>
      </div>
    );
  }
  return (
    <img
      src={book.cover}
      alt=""
      loading={priority ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}
