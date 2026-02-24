interface FormBadgesProps {
  form?: string;
  limit?: number;
}

export default function FormBadges({ form, limit = 5 }: FormBadgesProps) {
  if (!form) return <span className="text-gray-500 text-xs">—</span>;

  const chars = form.split("").slice(0, limit);

  return (
    <div className="flex gap-0.5">
      {chars.map((r, i) => (
        <span
          key={i}
          className={`
            inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold
            ${r === "W" ? "bg-green-500 text-white" :
              r === "D" ? "bg-gray-500 text-white" :
              "bg-red-500 text-white"}
          `}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
