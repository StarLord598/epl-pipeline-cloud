import { TEAM_COLORS, getTeamColor, getTeamShort, stripFC } from "@/lib/data";

interface TeamBadgeProps {
  teamName: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export default function TeamBadge({ teamName, size = "md", showName = false }: TeamBadgeProps) {
  const stripped = stripFC(teamName);
  const colorObj = TEAM_COLORS[teamName] || TEAM_COLORS[stripped] || { primary: getTeamColor(teamName), secondary: "#374151", text: "#fff" };
  const colors = colorObj;
  const abbr = getTeamShort(teamName);

  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-lg flex items-center justify-center font-black flex-shrink-0 shadow-lg transition-transform duration-200 hover:scale-105`}
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primary}cc)`,
          color: colors.text,
          boxShadow: `0 2px 8px ${colors.primary}40`,
        }}
      >
        {abbr}
      </div>
      {showName && (
        <span className="font-medium text-white">{teamName}</span>
      )}
    </div>
  );
}
