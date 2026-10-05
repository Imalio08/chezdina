import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { MessageCircle, ShoppingBag, ChevronLeft, ChevronRight, Star, Check } from "lucide-react";

function Stars({ value = 0, size = 14, onPick }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i=>(
        <button key={i} type="button" onClick={onPick?()=>onPick(i):undefined} disabled={!onPick}>
          <Star size={size} className={i<=Math.round(value)?"fill-[#f4b12c] text-[#f4b12c]":"text-[#ddd]"}/>
        </button>
      ))}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [imgIdx, setImgIdx] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const { addToCart } = useApp();

  useEffect(() => {
    api.get(`/public/product/${id}`).then(r => {
      setP(r.data);
      const firstStock = Object.entries(r.data.stock_by_size || {}).find(([,v])=>v>0);
      setSize(firstStock?.[0] || r.data.sizes?.[0] || "");
      setColor(r.data.colors?.[0] || "");
      setImgIdx(0);
    });
    api.get(`/public/reviews/${id}`).then(r=>setReviews(r.data));
  }, [id]);

  if (!p) return <div className="p-10 text-sm text-[#666]">Chargement…</div>;
  const gallery = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
  const current = gallery[imgIdx] || p.image;
  const stockForSize = size ? (p.stock_by_size?.[size] ?? 0) : (p.stock || 0);
  const canAdd = stockForSize > 0;

  const add = () => { if(!canAdd) return toast.error("Rupture pour cette taille"); addToCart(p,1,size,color); toast.success("Ajouté au panier"); };
  const wa = () => window.open(`https://wa.me/2250777926179?text=${encodeURIComponent(`Bonjour, je veux commander: ${p.name} (${size}, ${color}) ${fcfa(p.price)}`)}`,"_blank");
  const prev = () => setImgIdx((imgIdx-1+gallery.length)%gallery.length);
  const next = () => setImgIdx((imgIdx+1)%gallery.length);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/boutique/catalog" className="text-xs text-[#666] inline-flex items-center gap-1 mb-4"><ChevronLeft size={12}/>Retour catalogue</Link>
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="relative aspect-[4/5] bg-[#fff5f5] rounded-2xl overflow-hidden group">
            <img src={current} alt="" className="w-full h-full object-cover" data-testid="product-main-image"/>
            {gallery.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 grid place-items-center shadow" data-testid="product-prev"><ChevronLeft size={16}/></button>
                <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 grid place-items-center shadow" data-testid="product-next"><ChevronRight size={16}/></button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">{gallery.map((_,i)=><span key={i} className={`w-1.5 h-1.5 rounded-full ${i===imgIdx?"bg-[#b02a2a] w-5":"bg-white/80"} transition-all`}/>)}</div>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-3">{gallery.map((src,i)=>(
              <button key={i} onClick={()=>setImgIdx(i)} className={`aspect-square rounded-lg overflow-hidden border-2 transition ${imgIdx===i?"border-[#b02a2a]":"border-transparent"}`} data-testid={`product-thumb-${i}`}>
                <img src={src} alt="" className="w-full h-full object-cover"/>
              </button>
            ))}</div>
          )}
        </div>
        <div>
          <div className="text-xs text-[#b02a2a] uppercase tracking-wide">{p.brand} · {p.category}</div>
          <h1 className="font-serif text-3xl mt-1">{p.name}</h1>
          <div className="flex items-center gap-2 mt-2"><Stars value={p.rating_avg||0}/><span className="text-xs text-[#666]">{p.rating_avg||"—"} · {p.rating_count||0} avis</span></div>
          <div className="tabular text-2xl font-semibold mt-3">{fcfa(p.price)}</div>
          <p className="text-sm text-[#666] mt-4 leading-relaxed">{p.description}</p>

          {!!p.sizes?.length && (
            <div className="mt-6">
              <div className="text-xs uppercase text-[#666] mb-2">{p.category==="Chaussures"?"Pointure":"Taille"}</div>
              <div className="flex gap-2 flex-wrap">
                {p.sizes.map(s=>{
                  const stk = p.stock_by_size?.[s] ?? 0;
                  const out = stk === 0;
                  return (
                    <button key={s} onClick={()=>!out && setSize(s)} disabled={out} className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-lg border text-sm transition ${size===s?"bg-[#1c1c1c] text-white border-[#1c1c1c]":out?"border-[#ececec] text-[#ccc] line-through cursor-not-allowed":"border-[#ececec] hover:border-[#b02a2a]"}`} data-testid={`product-size-${s}`}>
                      <span className="font-semibold">{s}</span>
                      <span className={`text-[9px] ${out?"":size===s?"text-[#f0b8b8]":"text-[#999]"}`}>{out?"rupture":stk<=3?`${stk} restant${stk>1?"s":""}`:"dispo"}</span>
                    </button>
                  );
                })}
              </div>
              {size && <div className="text-xs text-[#666] mt-2">{stockForSize>0?`${stockForSize} en stock pour la ${p.category==="Chaussures"?"pointure":"taille"} ${size}`:"Rupture — essayez une autre taille"}</div>}
            </div>
          )}

          {!!p.colors?.length && (
            <div className="mt-5">
              <div className="text-xs uppercase text-[#666] mb-2">Couleur · <span className="text-[#1c1c1c] font-medium">{color}</span></div>
              <div className="flex gap-2 flex-wrap">{p.colors.map(c=><button key={c} onClick={()=>setColor(c)} className={`px-3 h-9 rounded-lg border text-xs ${color===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`product-color-${c}`}>{c}</button>)}</div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={add} disabled={!canAdd} className="dina-btn-primary flex-1" data-testid="product-add-cart"><ShoppingBag size={16}/>{canAdd?"Ajouter":"Rupture"}</button>
            <button onClick={wa} className="dina-btn-secondary flex-1" style={{background:"#1f8a4c",color:"white",borderColor:"#1f8a4c"}} data-testid="product-whatsapp"><MessageCircle size={16}/>WhatsApp</button>
          </div>
          <div className="text-xs text-[#666] mt-4 flex items-center gap-2"><Check size={12} className="text-[#1f8a4c]"/>Livraison 24h à Abidjan · Paiement à la livraison accepté</div>
        </div>
      </div>

      <section className="mt-14 border-t border-[#ececec] pt-10">
        <div className="flex items-center justify-between mb-6">
          <div><h2 className="font-serif text-2xl">Avis clientes ({reviews.length})</h2><div className="flex items-center gap-2 mt-1"><Stars value={p.rating_avg||0}/><span className="text-sm text-[#666]">{p.rating_avg||"—"}/5</span></div></div>
          <button onClick={()=>setShowReview(true)} className="dina-btn-primary !min-h-[40px]" data-testid="product-review-open">Laisser un avis</button>
        </div>
        {reviews.length === 0 ? <div className="text-sm text-[#666] text-center py-8 dina-card">Soyez la première à partager votre expérience sur ce produit.</div> : (
          <div className="grid md:grid-cols-2 gap-4">{reviews.map(r=>(
            <div key={r.id} className="dina-card p-4" data-testid={`review-${r.id}`}>
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif font-bold grid place-items-center text-sm">{(r.customer_name||"?")[0]}</div><div><div className="text-sm font-medium">{r.customer_name}</div><div className="text-xs text-[#999]">{dateFmt(r.created_at)}</div></div></div><Stars value={r.rating}/></div>
              {r.comment && <p className="text-sm text-[#666] leading-relaxed">{r.comment}</p>}
            </div>
          ))}</div>
        )}
      </section>

      {showReview && <ReviewForm productId={id} onClose={()=>setShowReview(false)} onDone={()=>{setShowReview(false); api.get(`/public/reviews/${id}`).then(r=>setReviews(r.data)); api.get(`/public/product/${id}`).then(r=>setP(r.data));}}/>}
    </div>
  );
}

function ReviewForm({ productId, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!name.trim()) return toast.error("Nom requis");
    setLoading(true);
    try {
      await api.post("/public/reviews", { product_id: productId, rating, comment, customer_name: name });
      toast.success("Merci pour votre avis !");
      onDone();
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Votre avis</div>
        <div className="mb-3"><div className="text-xs text-[#666] uppercase mb-2">Note</div><div className="flex gap-1">{[1,2,3,4,5].map(i=><button key={i} onClick={()=>setRating(i)} data-testid={`review-star-${i}`}><Star size={32} className={i<=rating?"fill-[#f4b12c] text-[#f4b12c]":"text-[#ddd]"}/></button>)}</div></div>
        <input className="dina-input mb-2" placeholder="Votre prénom" value={name} onChange={e=>setName(e.target.value)} data-testid="review-name"/>
        <textarea className="dina-input mb-4" placeholder="Partagez votre expérience (optionnel)" rows={4} value={comment} onChange={e=>setComment(e.target.value)} data-testid="review-comment"/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={loading} className="dina-btn-primary flex-1" data-testid="review-submit">{loading?"Envoi…":"Publier"}</button></div>
      </div>
    </div>
  );
}
