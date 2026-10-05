import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Settings() {
  const [biz, setBiz] = useState({});
  useEffect(() => { api.get("/business").then(r=>setBiz(r.data)); }, []);
  const save = async () => { try { await api.patch("/business", biz); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  const reseed = async () => { try { await api.post("/seed?force=true"); toast.success("Données réensemencées"); setTimeout(()=>window.location.reload(), 1000); } catch { toast.error("Réservé admin"); } };
  const upd = (k,v) => setBiz({...biz, [k]:v});

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Paramètres</h1><p className="text-sm text-[#666]">Informations commerce, utilisateurs, préférences · séparé du Site vitrine</p></div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Informations commerce</div>
          <div className="space-y-2 text-sm">
            <input className="dina-input" placeholder="Nom" value={biz.name||""} onChange={e=>upd("name",e.target.value)} data-testid="biz-name"/>
            <input className="dina-input" placeholder="Téléphone" value={biz.phone||""} onChange={e=>upd("phone",e.target.value)}/>
            <input className="dina-input" placeholder="WhatsApp (format intl.)" value={biz.whatsapp||""} onChange={e=>upd("whatsapp",e.target.value)}/>
            <input className="dina-input" placeholder="TikTok (@...)" value={biz.tiktok||""} onChange={e=>upd("tiktok",e.target.value)}/>
            <textarea className="dina-input" rows={2} placeholder="Adresse" value={biz.address||""} onChange={e=>upd("address",e.target.value)}/>
            <button onClick={save} className="dina-btn-primary !min-h-[38px]" data-testid="biz-save"><Save size={14}/>Enregistrer</button>
          </div>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Préférences caisse</div>
          <label className="flex items-center justify-between py-2 text-sm"><span>Espèces</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Wave Business</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Paiement à la livraison</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Porte-monnaie</span><input type="checkbox" defaultChecked/></label>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Utilisateurs & rôles</div>
          <p className="text-xs text-[#666] mb-3">Gérez vendeuses, managers et livreurs dans l'onglet <a href="/console/equipe" className="text-[#b02a2a] underline">Équipe</a>.</p>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Données de démonstration</div>
          <p className="text-xs text-[#666] mb-3">Réinitialiser avec un nouveau jeu de données de démo (clientes, produits, commandes).</p>
          <button onClick={reseed} className="dina-btn-secondary" data-testid="reseed-button">Réensemencer</button>
        </div>
      </div>
    </div>
  );
}
