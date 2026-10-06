import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { Star, Check } from "lucide-react";
import { toast } from "sonner";

export default function Rate() {
  const { code } = useParams();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState("");
  const [recommend, setRecommend] = useState(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/public/order/${code}`).then(r=>setOrder(r.data)).catch(()=>setNotFound(true));
  }, [code]);

  const submit = async () => {
    if (!rating) return toast.error("Donnez une note à votre commande");
    setSaving(true);
    try {
      await api.post(`/public/rate/${code}`, { rating, rider_rating: riderRating || rating, comment, recommend });
      setDone(true);
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  if (notFound) return <div className="min-h-screen grid place-items-center p-4"><div className="text-center"><div className="font-serif text-2xl mb-2">Commande introuvable</div><div className="text-sm text-[#666]">Vérifiez votre lien</div></div></div>;
  if (!order) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;

  if (done) return (
    <div className="min-h-screen grid place-items-center p-4 bg-[#fff5f5]">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#1f8a4c] grid place-items-center text-white mx-auto mb-3"><Check size={30}/></div>
        <div className="font-serif text-2xl mb-2">Merci {order.customer?.name?.split(" ")[0]} !</div>
        <div className="text-sm text-[#666]">Votre avis nous aide à améliorer notre service. À très vite !</div>
      </div>
    </div>
  );

  const Stars = ({ value, onChange, size=28, name }) => (
    <div className="flex gap-1 justify-center" data-testid={`${name}-stars`}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n)} className="transition hover:scale-110" data-testid={`${name}-star-${n}`}>
          <Star size={size} className={n<=value?"fill-[#f4b12c] text-[#f4b12c]":"text-[#ececec]"}/>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fff5f5] p-4">
      <div className="max-w-sm mx-auto">
        <div className="text-center py-5">
          <div className="font-serif text-3xl text-[#b02a2a]">Chez Dina</div>
          <div className="text-xs text-[#666]">Votre avis compte</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <div className="text-sm text-[#666] mb-1">Commande</div>
            <div className="font-serif text-lg">{order.code}</div>
            <div className="text-xs text-[#666]">{order.items?.length} article(s) · livrée {order.delivered_at?new Date(order.delivered_at).toLocaleDateString("fr-FR"):""}</div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Comment s'est passée votre commande ?</div>
            <Stars value={rating} onChange={setRating} name="order"/>
          </div>
          {order.rider_name && (
            <div>
              <div className="text-sm font-semibold mb-2">Et votre livreur <strong>{order.rider_name}</strong> ?</div>
              <Stars value={riderRating} onChange={setRiderRating} size={22} name="rider"/>
            </div>
          )}
          <div>
            <div className="text-sm font-semibold mb-2">Un commentaire ? (optionnel)</div>
            <textarea className="dina-input" rows={3} placeholder="Dites-nous ce que vous avez aimé ou ce qu'on peut améliorer…" value={comment} onChange={e=>setComment(e.target.value)} data-testid="rate-comment"/>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Recommanderiez-vous Chez Dina ?</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>setRecommend(true)} className={`py-3 rounded-lg border font-semibold ${recommend===true?"bg-[#1f8a4c] text-white border-[#1f8a4c]":"border-[#ececec]"}`} data-testid="rate-yes">👍 Oui</button>
              <button onClick={()=>setRecommend(false)} className={`py-3 rounded-lg border font-semibold ${recommend===false?"bg-[#c62828] text-white border-[#c62828]":"border-[#ececec]"}`} data-testid="rate-no">👎 Non</button>
            </div>
          </div>
          <button onClick={submit} disabled={saving||!rating} className="dina-btn-primary w-full" data-testid="rate-submit">{saving?"Envoi…":"Envoyer mon avis"}</button>
        </div>
      </div>
    </div>
  );
}
