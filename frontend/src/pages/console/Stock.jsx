import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function Stock() {
  const [products, setProducts] = useState([]);
  useEffect(() => { api.get("/products").then(r=>setProducts(r.data)); }, []);
  const totalValue = products.reduce((s,p)=>s+p.stock*p.cost,0);
  const retailValue = products.reduce((s,p)=>s+p.stock*p.price,0);
  const low = products.filter(p=>p.stock<5);
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Stock</h1><p className="text-sm text-[#666]">Mouvements, inventaires, alertes</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Valeur au coût</div><div className="font-serif text-2xl tabular">{fcfa(totalValue)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Valeur au prix</div><div className="font-serif text-2xl tabular">{fcfa(retailValue)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Références</div><div className="font-serif text-2xl tabular">{products.length}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Stock faible</div><div className="font-serif text-2xl tabular text-[#c62828]">{low.length}</div></div>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Alertes stock faible</div>
        <table className="dina-table">
          <thead><tr><th>Produit</th><th>Catégorie</th><th>SKU</th><th className="text-right">Stock</th><th className="text-right">Prix</th><th className="text-right">À commander</th></tr></thead>
          <tbody>{low.map(p=><tr key={p.id} data-testid={`stock-low-${p.sku}`}><td className="font-medium">{p.name}</td><td>{p.category}</td><td className="font-mono text-xs">{p.sku}</td><td className="text-right tabular text-[#c62828] font-semibold">{p.stock}</td><td className="text-right tabular">{fcfa(p.price)}</td><td className="text-right tabular">+{20-p.stock}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
