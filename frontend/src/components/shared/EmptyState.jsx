import React from "react";

export default function EmptyState({ icon: Icon, title = "Aucune donnée", description, action, testid = "empty-state" }) {
  return (
    <div className="text-center py-12 px-6" data-testid={testid}>
      {Icon && <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#fff5f5] dark:bg-[#2a1818] grid place-items-center text-[#b02a2a]"><Icon size={22}/></div>}
      <div className="font-serif text-lg mb-1">{title}</div>
      {description && <div className="text-sm text-[#666] mb-4 max-w-sm mx-auto">{description}</div>}
      {action}
    </div>
  );
}
