import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function SubPage({ title, testid, children }) {
  const nav = useNavigate();
  return (
    <div className="space-y-3" data-testid={testid}>
      <div className="flex items-center gap-2 px-1">
        <button onClick={() => nav("/riders/profil")} className="w-9 h-9 rounded-full bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] grid place-items-center" aria-label="Retour au profil" data-testid="rider-subpage-back"><ArrowLeft size={16}/></button>
        <div className="font-serif text-xl">{title}</div>
      </div>
      {children}
    </div>
  );
}
