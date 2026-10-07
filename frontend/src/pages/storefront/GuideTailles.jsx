import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function GuideTailles() {
  const [content, setContent] = useState(null);
  useEffect(() => {
    api.get("/public/cms-page/guide-tailles").then(r => setContent(r.data)).catch(() => setContent({ title: "Guide des tailles", content: "" }));
  }, []);
  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="page-guide-tailles">
      <h1 className="font-serif text-3xl mb-2">{content?.title || "Guide des tailles"}</h1>
      <p className="text-sm text-[#666] mb-6">Trouvez votre taille en un coup d'œil — vêtements et chaussures.</p>
      {content?.content ? (
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content.content }}/>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="font-serif text-xl mb-3">Vêtements (en cm)</h2>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-[#fff5f5]"><th className="p-2 text-left">Taille</th><th className="p-2">Poitrine</th><th className="p-2">Taille</th><th className="p-2">Hanches</th></tr></thead>
              <tbody>
                {[["XS",82,62,88],["S",86,66,92],["M",90,70,96],["L",96,76,102],["XL",102,82,108],["XXL",108,88,114]].map(r => (
                  <tr key={r[0]} className="border-b"><td className="p-2 font-semibold">{r[0]}</td><td className="p-2 text-center tabular">{r[1]}</td><td className="p-2 text-center tabular">{r[2]}</td><td className="p-2 text-center tabular">{r[3]}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h2 className="font-serif text-xl mb-3">Chaussures (EUR)</h2>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-[#fff5f5]"><th className="p-2 text-left">Pointure</th><th className="p-2">36</th><th className="p-2">37</th><th className="p-2">38</th><th className="p-2">39</th><th className="p-2">40</th><th className="p-2">41</th><th className="p-2">42</th></tr></thead>
              <tbody><tr><td className="p-2 font-semibold">Pied (cm)</td>{[23,23.5,24,24.5,25,25.8,26.5].map(c => <td key={c} className="p-2 text-center tabular">{c}</td>)}</tr></tbody>
            </table>
          </section>
          <p className="text-xs text-[#666] italic">Si vous hésitez entre deux tailles, prenez la plus grande. Pour les sacs et accessoires, aucune taille requise.</p>
        </div>
      )}
    </div>
  );
}
