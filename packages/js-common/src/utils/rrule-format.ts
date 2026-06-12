/**
 * Converts an RRule expression to a human-readable schedule description
 */
export function formatRRuleSchedule(
  patternConfig: { expression: string; type?: string; timezone?: string } | undefined | null
): string {
  if (!patternConfig?.expression) return "No schedule set";

  const expression = patternConfig.expression;
  const parts = expression.split(";").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  const freq = parts["FREQ"]?.toLowerCase();
  const interval = parts["INTERVAL"] ? parseInt(parts["INTERVAL"]) : 1;
  const byDay = parts["BYDAY"];
  const byMonthDay = parts["BYMONTHDAY"];

  let description = "";

  // Build frequency description
  if (freq === "daily") {
    description = interval === 1 ? "Daily" : `Every ${interval} days`;
  } else if (freq === "weekly") {
    description = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    if (byDay) {
      const dayNames: Record<string, string> = {
        MO: "Monday",
        TU: "Tuesday",
        WE: "Wednesday",
        TH: "Thursday",
        FR: "Friday",
        SA: "Saturday",
        SU: "Sunday",
      };
      const days = byDay
        .split(",")
        .map((d) => dayNames[d] || d)
        .join(", ");
      description += ` on ${days}`;
    }
  } else if (freq === "monthly") {
    description = interval === 1 ? "Monthly" : `Every ${interval} months`;
    if (byMonthDay) {
      const day = parseInt(byMonthDay);
      const suffix = getOrdinalSuffix(day);
      description += ` on the ${day}${suffix}`;
    } else if (byDay) {
      // Handle nth day of month (e.g., "2TU" = 2nd Tuesday)
      const match = byDay.match(/^(\d+)?([A-Z]+)$/);
      if (match) {
        const nth = match[1] ? parseInt(match[1]) : 1;
        const dayCode = match[2];
        const dayNames: Record<string, string> = {
          MO: "Monday",
          TU: "Tuesday",
          WE: "Wednesday",
          TH: "Thursday",
          FR: "Friday",
          SA: "Saturday",
          SU: "Sunday",
        };
        const nthNames = ["first", "second", "third", "fourth", "last"];
        const nthName = nth === -1 ? "last" : nthNames[nth - 1] || `${nth}th`;
        description += ` on the ${nthName} ${dayNames[dayCode!] || dayCode}`;
      }
    }
  } else if (freq === "yearly") {
    description = interval === 1 ? "Yearly" : `Every ${interval} years`;
  } else {
    description = expression;
  }

  return description;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0]!;
}


