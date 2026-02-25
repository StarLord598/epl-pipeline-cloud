interface FormBadgesProps {
  form?: string;
  limit?: number;
}

export default function FormBadges({ form, limit = 5 }: FormBadgesProps) {
  if (!form) return <span className="text-gray-600 text-xs">--</span>;

  const chars = form.split("").slice(0, limit);

  return (
    <div className="flex gap-0.5">
      {chars.map((r, i) => (
        <span
          key={i}
          className={`
            inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold transition-all
            ${r === "W" ? "bg-green-500/80 text-white shadow-sm shadow-green-500/20" :
              r === "D" ? "bg-gray-500/60 text-white" :
              "bg-red-500/80 text-white shadow-sm shadow-red-500/20"}
          `}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
