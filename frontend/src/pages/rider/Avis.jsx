import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import SubPage from "@/components/rider/SubPage";
import { ReviewsList } from "@/pages/rider/Performance";

export default function Avis() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(null);
  useEffect(() => { if (user) api.get(`/riders/${user.id}/reviews`).then(r => setReviews(r.data)).catch(() => setReviews([])); }, [user]);
  const avg = reviews?.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  return (
    <SubPage title="Avis clients" testid="rider-avis-page">
      {!reviews ? <div className="text-sm text-[#666] text-center py-10">Chargement…</div> : <>
        {avg && <div className="dina-card-white p-4 flex items-center justify-between" data-testid="avis-average"><span className="text-sm text-[#666]">Note moyenne · {reviews.length} avis</span><span className="font-serif text-2xl text-[#f4b12c] tabular">{avg}★</span></div>}
        <ReviewsList reviews={reviews}/>
      </>}
    </SubPage>
  );
}
