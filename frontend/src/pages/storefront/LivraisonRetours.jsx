import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function LivraisonRetours() {
  const [zones, setZones] = useState([]);
  const [cms, setCms] = useState(null);
  useEffect(() => {
    api.get("/public/site").then(r => setZones(r.data?.zones || [])).catch(() => {});
    api.get("/public/cms-page/livraison-retours").then(r => setCms(r.data)).catch(() => {});
  }, []);
  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="page-livraison">
      <h1 className="font-serif text-3xl mb-2">Livraison & retours</h1>
      <p className="text-sm text-[#666] mb-6">Zones, tarifs, délais et politique de retour.</p>
      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Zones & tarifs à Abidjan</h2>
        <div className="dina-card p-4">
          {zones.length === 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="bg-[#fff5f5]"><th className="p-2 text-left">Zone</th><th className="p-2 text-right">Tarif</th><th className="p-2 text-right">Délai</th></tr></thead>
              <tbody>{[["Plateau",1000,"2 h"],["Cocody",1500,"3 h"],["Marcory / Zone 4",1500,"3 h"],["Riviera / Angré",2000,"4 h"],["Yopougon",2500,"4 h"],["Abobo",3000,"4 h"],["Bingerville",3000,"6 h"],["Grand-Bassam",5000,"24 h"]].map(r => <tr key={r[0]} className="border-b last:border-0"><td className="p-2">{r[0]}</td><td className="p-2 text-right tabular font-semibold">{fcfa(r[1])}</td><td className="p-2 text-right text-[#666]">{r[2]}</td></tr>)}</tbody>
            </table>
          ) : (
            <ul className="space-y-1 text-sm">{zones.map(z => <li key={z.name} className="flex justify-between"><span>{z.name}</span><span className="tabular font-semibold">{fcfa(z.price || z.fee || 0)}</span></li>)}</ul>
          )}
        </div>
      </section>
      <section>
        <h2 className="font-serif text-xl mb-3">Retours & échanges</h2>
        <div className="prose prose-sm max-w-none">
          {cms?.content ? <div dangerouslySetInnerHTML={{ __html: cms.content }}/> : (
            <>
              <p>Vous disposez de <strong>48 heures</strong> après la livraison pour signaler un problème ou demander un échange (taille, couleur, défaut).</p>
              <ul>
                <li>L'article doit être <strong>non porté</strong>, dans son emballage d'origine, avec étiquette.</li>
                <li>Les sous-vêtements et bijoux ne sont ni repris ni échangés pour raisons d'hygiène.</li>
                <li>Les frais de retour sont à votre charge sauf en cas de défaut avéré.</li>
                <li>Remboursement par Wave ou avoir sous 72 h après réception.</li>
              </ul>
              <p>Contactez-nous sur WhatsApp au <strong>+225 07 77 92 61 79</strong> pour organiser un retour.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
