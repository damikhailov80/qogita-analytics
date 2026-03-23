'use client';

import AllegroUpload from "@/components/updates/allegro-update";
import QogitaUpdate from "@/components/updates/qogita-update";
import OffersUpdate from "@/components/updates/offers-update";

export default function Home() {

  return (
    <div className="container mx-auto py-20 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to Qogita</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Product catalog management system
        </p>
      </div>

      {/* Grid layout for components */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {/* Qogita Update */}
        <div className="col-span-1 flex">
          <QogitaUpdate />
        </div>

        {/* Allegro Upload */}
        <div className="col-span-1 flex">
          <AllegroUpload />
        </div>

        {/* Offers Update */}
        <div className="col-span-1 flex">
          <OffersUpdate />
        </div>
      </div>
    </div>
  );
}
