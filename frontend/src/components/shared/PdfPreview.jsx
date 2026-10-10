import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf";
import { Download, Printer, Share2, X } from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
let openFn = null;

// Open a jsPDF document in the preview modal (falls back to download if host absent)
export function openPdf(doc, filename) {
  if (!openFn) return doc.save(filename);
  openFn({ blob: doc.output("blob"), filename });
}

export function PdfPreviewHost() {
  const [job, setJob] = useState(null);
  useEffect(() => { openFn = setJob; return () => { openFn = null; }; }, []);
  return job ? <PdfPreviewModal job={job} onClose={() => setJob(null)}/> : null;
}

function PdfPages({ blob }) {
  const ref = useRef(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
        const box = ref.current; if (!box || cancelled) return;
        box.innerHTML = "";
        const width = Math.min(box.clientWidth - 16, 900);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
          const vp = page.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = `${width}px`; c.style.height = `${(vp.height / vp.width) * width}px`;
          c.className = "bg-white shadow-md rounded mx-auto block mb-3";
          await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          if (cancelled) return;
          box.appendChild(c);
        }
        setState("ok");
      } catch { if (!cancelled) setState("error"); }
    })();
    return () => { cancelled = true; };
  }, [blob]);
  return (
    <div className="flex-1 overflow-auto p-2 sm:p-4 bg-[#e9e9e9] dark:bg-[#0f0f0f]">
      {state === "loading" && <div className="text-center text-sm text-[#666] py-10">Chargement de l'aperçu…</div>}
      {state === "error" && <div className="text-center text-sm text-[#c62828] py-10">Aperçu indisponible · utilisez Télécharger</div>}
      <div ref={ref} data-testid="pdf-preview-pages"/>
    </div>
  );
}

function PdfPreviewModal({ job, onClose }) {
  const [url] = useState(() => URL.createObjectURL(job.blob));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const download = () => { const a = document.createElement("a"); a.href = url; a.download = job.filename; a.click(); };
  const print = () => {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.src = url;
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(url, "_blank"); } setTimeout(() => f.remove(), 60000); };
    document.body.appendChild(f);
  };
  const file = new File([job.blob], job.filename, { type: "application/pdf" });
  const canShare = typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] });
  const share = async () => { try { await navigator.share({ files: [file], title: job.filename }); } catch (e) { if (e?.name !== "AbortError") toast.error("Partage impossible"); } };
  const btn = "dina-btn-secondary !min-h-[36px] text-xs";
  return (
    <div className="fixed inset-0 z-[95] bg-black/70 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose} data-testid="pdf-preview-modal">
      <div className="bg-white dark:bg-[#1a1a1a] w-full sm:max-w-4xl h-full sm:h-[92vh] sm:rounded-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-[#ececec] dark:border-[#2a2a2a] flex-wrap">
          <div className="font-semibold text-sm truncate flex-1 min-w-0" data-testid="pdf-preview-title">{job.filename}</div>
          <button onClick={download} className={btn} data-testid="pdf-preview-download"><Download size={13}/><span className="hidden sm:inline">Télécharger</span></button>
          <button onClick={print} className={btn} data-testid="pdf-preview-print"><Printer size={13}/><span className="hidden sm:inline">Imprimer</span></button>
          {canShare && <button onClick={share} className={btn} data-testid="pdf-preview-share"><Share2 size={13}/><span className="hidden sm:inline">Partager</span></button>}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]" data-testid="pdf-preview-close" aria-label="Fermer"><X size={18}/></button>
        </div>
        <PdfPages blob={job.blob}/>
      </div>
    </div>
  );
}
