import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { getVisitorId } from "@/lib/analytics";
import { fcfa } from "@/lib/format";
import { Gift } from "lucide-react";

export const REF_KEY = "dina_ref";

// Landing page of a personal invitation link: keeps the code for signup and counts the open
export default function Invitation() {
  const { code } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.get(`/public/referral/${encodeURIComponent(code)}`).then(r => {
      setInfo(r.data);
      localStorage.setItem(REF_KEY, r.data.code);
      api.post(`/public/referral/${r.data.code}/open`, { visitor_id: getVisitorId() }).catch(() => {});
    }).catch(() => setErr(true));
  }, [code]);
  if (err) return <div className="max-w-md mx-auto px-4 py-16 text-center" data-testid="invitation-invalid"><div className="font-serif text-2xl mb-2">Lien d'invitation invalide</div><Link to="/" className="dina-btn-primary inline-flex mt-3">Découvrir la boutique</Link></div>;
  if (!info) return <div className="text-center py-16 text-sm text-[#666]">Chargement…</div>;
  return (
    <div className="max-w-md mx-auto px-4 py-10 text-center" data-testid="invitation-page">
      <div className="w-20 h-20 rounded-full bg-[#fde8e8] grid place-items-center mx-auto mb-4"><Gift size={36} className="text-[#b02a2a]"/></div>
      <h1 className="font-serif text-3xl mb-2">{info.first_name || "Une amie"} vous invite</h1>
      <p className="text-sm text-[#666] mb-6">Créez votre compte avec son code <b className="font-mono text-[#b02a2a]">{info.code}</b> : vous recevez <b>{fcfa(info.bonus_filleul)}</b> dans votre porte-monnaie, à utiliser dès votre première commande.</p>
      <button onClick={() => nav("/compte?mode=inscription")} className="dina-btn-primary w-full" data-testid="invitation-signup">Créer mon compte</button>
      <Link to="/" className="block text-xs text-[#666] underline mt-4" data-testid="invitation-browse">Voir la boutique d'abord · le code est gardé</Link>
    </div>
  );
}
