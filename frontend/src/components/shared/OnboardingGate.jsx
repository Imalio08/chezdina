import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { FileSignature, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SignaturePad from "@/components/shared/SignaturePad";

// Blocks the console / rider app until every assigned HR document is read and signed (drawn signature + PIN).
export default function OnboardingGate() {
  const { user, setUser, logout } = useAuth();
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState("");
  const load = () => { setErr(""); return api.get("/onboarding/me").then(r => {
    setDocs(r.data.to_sign);
    if (!r.data.to_sign.length) setUser(u => ({ ...u, onboarding_required: false }));
  }).catch(e => setErr(e?.response?.data?.detail || "Connexion impossible")); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const doc = docs?.[0];
  return (
    <div className="min-h-screen bg-[#faf7f5] dark:bg-[#0f0f0f] p-4" data-testid="onboarding-gate">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-start gap-3">
          <FileSignature className="text-[#b02a2a] mt-1" size={22} />
          <div className="flex-1"><h1 className="font-serif text-2xl">Documents à signer</h1>
            <p className="text-sm text-[#666]">Bonjour {user?.name?.split(" ")[0]}, lisez et signez {docs?.length > 1 ? `ces ${docs.length} documents` : "ce document"} pour accéder à vos outils.</p></div>
          <button onClick={logout} className="text-xs text-[#666] flex items-center gap-1" data-testid="onboarding-logout"><LogOut size={12} />Quitter</button>
        </div>
        {err && <div className="dina-card-white p-4 text-sm text-[#c62828] flex justify-between items-center" data-testid="onboarding-error">{err}<button onClick={load} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="onboarding-retry">Réessayer</button></div>}
        {docs === null && !err && <div className="text-sm text-[#666]">Chargement…</div>}
        {doc && <SignDoc key={doc.id} doc={doc} index={1} total={docs.length} onSigned={load} />}
        {docs && !docs.length && <div className="dina-card-white p-6 text-center"><CheckCircle2 className="mx-auto text-[#1f8a4c]" /><div className="mt-2 font-semibold">Tout est signé · merci !</div></div>}
      </div>
    </div>
  );
}

function SignDoc({ doc, total, onSigned }) {
  const [ok, setOk] = useState(false);
  const [sig, setSig] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!ok) return toast.error("Cochez « J'ai lu et j'accepte »");
    if (!sig) return toast.error("Signez dans le cadre");
    if (pin.length < 4) return toast.error("Saisissez votre code PIN");
    setBusy(true);
    try {
      await api.post(`/onboarding/me/sign/${doc.id}`, { accepted: true, signature: sig, pin, device: `${navigator.platform || ""} · ${navigator.userAgent}`.slice(0, 120) });
      toast.success("Document signé · PDF enregistré dans votre dossier"); onSigned();
    } catch (e) { toast.error(e?.response?.data?.detail || "Signature impossible"); } finally { setBusy(false); }
  };
  return (
    <div className="dina-card-white p-5 space-y-4" data-testid={`sign-doc-${doc.kind}`}>
      <div className="flex justify-between items-baseline gap-2"><div className="font-semibold">{doc.title}</div><div className="text-xs text-[#666] whitespace-nowrap">Version {doc.version} · {total} restant{total > 1 ? "s" : ""}</div></div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[45vh] overflow-y-auto border border-[#ececec] rounded-lg p-3 bg-[#fcfcfc] dark:bg-[#151515]" data-testid="sign-doc-body">{doc.body}</div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} data-testid="sign-accept" />J'ai lu et j'accepte</label>
      <SignaturePad onChange={setSig} />
      <div className="flex gap-2 items-center">
        <input className="dina-input max-w-[160px] text-center tracking-widest" type="password" inputMode="numeric" maxLength={6} placeholder="Code PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} data-testid="sign-pin" />
        <button onClick={submit} disabled={busy} className="dina-btn-primary flex-1 !min-h-[44px]" data-testid="sign-submit">{busy ? "Signature…" : "Signer le document"}</button>
      </div>
      <p className="text-[11px] text-[#999]">La date, l'heure, l'appareil et l'adresse IP sont enregistrés avec votre signature.</p>
    </div>
  );
}
