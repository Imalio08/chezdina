import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Scrolls to and flashes the element matching ?focus=ID once it renders.
export default function useFocusParam() {
  const [sp] = useSearchParams();
  const id = sp.get("focus");
  useEffect(() => {
    if (!id) return;
    let tries = 0;
    const t = setInterval(() => {
      const el = document.querySelector(`[data-focus-id="${CSS.escape(id)}"]`);
      if (el || ++tries > 25) clearInterval(t);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("focus-flash");
      setTimeout(() => el.classList.remove("focus-flash"), 3000);
    }, 200);
    return () => clearInterval(t);
  }, [id]);
}
