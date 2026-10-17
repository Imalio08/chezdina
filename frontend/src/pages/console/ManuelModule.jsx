import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Info, Lightbulb, AlertTriangle,
  Pencil, Save, X, Target, GraduationCap, Image as ImageIcon, PlayCircle
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as Lucide from "lucide-react";
import AnnotatedScreenshot from "@/components/manual/AnnotatedScreenshot";
import PhotoAnnotated from "@/components/manual/PhotoAnnotated";

export default function ManuelModule() {
  const { number } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [mod, setMod] = useState(null);
  const [allMods, setAllMods] = useState([]);
  const [editing, setEditing] = useState(false);

  const num = parseInt(number, 10);
  const canEdit = ["admin", "manager"].includes(user?.role);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get(`/manual/modules/${num}`), api.get("/manual/modules")]);
      setMod(a.data); setAllMods(b.data || []);
    } catch { toast.error("Module introuvable"); nav("/console/manuel"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [num]);

  if (!mod) return <div className="text-sm text-[#666]">Chargement…</div>;

  const Icon = Lucide[mod.icon] || Lucide.BookOpen;
  const prev = allMods.find(m => m.number === num - 1);
  const next = allMods.find(m => m.number === num + 1);

  const markRead = async (sectionId) => {
    try {
      await api.post("/manual/progress", { module_number: num, section_id: sectionId });
      setMod({ ...mod, sections: mod.sections.map(s => s.id === sectionId ? { ...s, read: true } : s) });
      toast.success("Section marquée comme lue");
    } catch { toast.error("Erreur"); }
  };

  const save = async (patch) => {
    try { await api.patch(`/manual/modules/${num}`, patch); toast.success("Enregistré"); setEditing(false); load(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      {/* TOC sidebar */}
      <aside className="dina-card-white p-3 h-fit sticky top-24 max-h-[80vh] overflow-y-auto" data-testid="manuel-toc">
        <Link to="/console/manuel" className="flex items-center gap-1.5 text-xs text-[#666] mb-3 hover:text-[#b02a2a]">
          <ArrowLeft size={12}/> Tous les modules
        </Link>
        <div className="space-y-0.5">
          {allMods.map(m => (
            <Link
              key={m.number}
              to={`/console/manuel/${m.number}`}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-sm ${m.number === num ? "bg-[#fff5f5] text-[#b02a2a] font-semibold" : "hover:bg-[#fafafa] text-[#1c1c1c]"}`}
              data-testid={`toc-item-${m.number}`}
            >
              <span className="text-[10px] text-[#999] w-5">{String(m.number).padStart(2, "0")}</span>
              <span className="truncate">{m.title}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 space-y-5" data-testid={`manuel-module-${num}`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#fff5f5] text-[#b02a2a] grid place-items-center shrink-0">
            <Icon size={24}/>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-[#999]">Module {String(num).padStart(2, "0")}</div>
            <h1 className="font-serif text-3xl">{mod.title}</h1>
            <p className="text-sm text-[#666] mt-1">{mod.description}</p>
          </div>
          {canEdit && !editing && <button onClick={() => setEditing(true)} className="dina-btn-secondary !min-h-[36px]" data-testid="manuel-edit"><Pencil size={14}/> Éditer</button>}
        </div>

        {/* Objectives */}
        <div className="dina-card-white p-5 border-l-4 border-[#1f8a4c]" data-testid="manuel-objectives">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-[#1f8a4c]"/>
            <div className="font-serif text-lg">Objectifs du module</div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {(mod.sections || []).map(s => (
              <li key={s.id} className="flex items-start gap-2">
                <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${s.read ? "text-[#1f8a4c]" : "text-[#ddd]"}`}/>
                <span>{s.heading}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sections */}
        {(mod.sections || []).map((s, idx) => (
          <section id={s.id} key={s.id} className="dina-card-white p-6" data-testid={`manuel-section-${s.id}`}>
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-serif text-xl flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#b02a2a] text-white grid place-items-center text-sm">{idx + 1}</span>
                {s.heading}
              </h2>
              {s.read && <span className="text-xs text-[#1f8a4c] flex items-center gap-1"><Check size={12}/> Lu</span>}
            </div>
            <div className="space-y-4 text-sm leading-relaxed">
              {(s.blocks || []).map((b, bi) => <Block key={bi} b={b}/>)}
            </div>
            {!s.read && (
              <div className="mt-4 pt-4 border-t border-[#ececec]">
                <button onClick={() => markRead(s.id)} className="dina-btn-secondary !min-h-[36px]" data-testid={`mark-read-${s.id}`}><Check size={14}/> Marquer comme lu</button>
              </div>
            )}
          </section>
        ))}

        {editing && <EditModal mod={mod} onClose={() => setEditing(false)} onSave={save}/>}

        {/* Prev / Next */}
        <div className="grid md:grid-cols-2 gap-3">
          {prev ? (
            <Link to={`/console/manuel/${prev.number}`} className="dina-card-white p-4 hover:border-[#b02a2a] transition" data-testid="prev-module">
              <div className="text-xs text-[#666] flex items-center gap-1"><ArrowLeft size={12}/> Précédent</div>
              <div className="font-serif text-base mt-1">Module {prev.number} · {prev.title}</div>
            </Link>
          ) : <div/>}
          {next && (
            <Link to={`/console/manuel/${next.number}`} className="dina-card-white p-4 text-right hover:border-[#b02a2a] transition" data-testid="next-module">
              <div className="text-xs text-[#666] flex items-center gap-1 justify-end">Suivant <ArrowRight size={12}/></div>
              <div className="font-serif text-base mt-1">Module {next.number} · {next.title}</div>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function Block({ b }) {
  if (b.type === "text") return <p>{b.content}</p>;
  if (b.type === "list") return <ul className="list-disc pl-5 space-y-1">{(b.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>;
  if (b.type === "steps") return (
    <ol className="space-y-2">
      {(b.items || []).map((it, i) => (
        <li key={i} className="flex gap-3" data-testid={`step-${i}`}>
          <span className="w-7 h-7 rounded-full bg-[#fff5f5] border-2 border-[#b02a2a] text-[#b02a2a] font-bold text-xs grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
          <span className="flex-1 pt-1">{it}</span>
        </li>
      ))}
    </ol>
  );
  if (b.type === "statuses") return (
    <div className="grid md:grid-cols-2 gap-2">
      {(b.items || []).map((it, i) => (
        <div key={i} className="p-3 rounded-lg bg-[#fafafa]">
          <div className="font-semibold text-sm">{it.name}</div>
          <div className="text-xs text-[#666] mt-0.5">{it.desc}</div>
        </div>
      ))}
    </div>
  );
  if (b.type === "callout") {
    const variants = {
      info: { icon: Info, bg: "bg-[#eef4fb]", border: "border-[#5867fd]", text: "text-[#1c1c1c]", title: "Bon à savoir" },
      tip: { icon: Lightbulb, bg: "bg-[#fff8e6]", border: "border-[#e4991e]", text: "text-[#1c1c1c]", title: "Astuce" },
      warning: { icon: AlertTriangle, bg: "bg-[#fff5f5]", border: "border-[#c62828]", text: "text-[#1c1c1c]", title: "Attention" },
    };
    const v = variants[b.variant] || variants.info;
    const VIcon = v.icon;
    return (
      <div className={`p-3 rounded-lg border-l-4 ${v.bg} ${v.border}`} data-testid={`callout-${b.variant}`}>
        <div className="flex items-center gap-2 font-semibold text-sm mb-1"><VIcon size={14}/>{v.title}</div>
        <div className="text-sm">{b.text}</div>
      </div>
    );
  }
  if (b.type === "screenshot") return (
    <div className="rounded-lg overflow-hidden border border-[#ececec]">
      <img src={b.image} alt={b.caption || ""} className="w-full"/>
      {b.caption && <div className="p-2 bg-[#fafafa] text-xs text-[#666]">{b.caption}</div>}
    </div>
  );
  if (b.type === "photo") return <PhotoAnnotated image={b.image} callouts={b.callouts || []} caption={b.caption}/>;
  if (b.type === "annotated") return (
    <AnnotatedScreenshot screen={b.screen} callouts={b.callouts || []} caption={b.caption}/>
  );
  if (b.type === "video_placeholder") return (
    <div className="rounded-xl border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] p-6 text-center bg-[#fafafa] dark:bg-[#141414]">
      <PlayCircle size={32} className="mx-auto mb-2 text-[#b02a2a]"/>
      <div className="font-serif text-sm text-[#1c1c1c] dark:text-white">{b.title || "Vidéo courte"}</div>
      <div className="text-xs text-[#666] mt-1 italic">{b.caption || "Enregistrement 10–30 s à venir."}</div>
    </div>
  );
  if (b.type === "memo") return (
    <div className="rounded-xl border border-[#b02a2a] bg-white dark:bg-[#1a1a1a] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-serif text-base">Mémo A4 · {b.role_label}</div>
        <button onClick={() => window.print()} className="text-xs text-[#b02a2a] font-semibold hover:underline">Imprimer</button>
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm">{(b.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
    </div>
  );
  if (b.type === "glossary") return (
    <dl className="divide-y divide-[#ececec] dark:divide-[#2a2a2a] rounded-lg border border-[#ececec] dark:border-[#2a2a2a]">
      {(b.items || []).map((it, i) => (
        <div key={i} className="grid grid-cols-[180px_1fr] gap-3 px-3 py-2">
          <dt className="font-semibold text-sm">{it.term}</dt>
          <dd className="text-sm text-[#666]">{it.def}</dd>
        </div>
      ))}
    </dl>
  );
  if (b.type === "faq") return (
    <div className="space-y-2">{(b.items || []).map((q, i) => (
      <details key={i} className="rounded-lg border border-[#ececec] dark:border-[#2a2a2a] px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold">{q.q}</summary>
        <div className="text-sm text-[#666] mt-2">{q.a}</div>
      </details>
    ))}</div>
  );
  return null;
}

function EditModal({ mod, onClose, onSave }) {
  const [draft, setDraft] = useState({ title: mod.title, description: mod.description, sections: JSON.stringify(mod.sections, null, 2) });
  const submit = () => {
    try {
      const sections = JSON.parse(draft.sections);
      onSave({ title: draft.title, description: draft.description, sections });
    } catch { toast.error("JSON des sections invalide"); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div className="font-serif text-xl">Éditer le module</div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Titre" value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})}/>
          <textarea className="dina-input" rows={2} placeholder="Description" value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})}/>
          <div>
            <label className="text-xs text-[#666] block mb-1">Sections (JSON — avancé)</label>
            <textarea className="dina-input font-mono text-xs" rows={14} value={draft.sections} onChange={e => setDraft({...draft, sections: e.target.value})} data-testid="manuel-sections-json"/>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} className="dina-btn-primary flex-1" data-testid="manuel-save"><Save size={14}/> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
