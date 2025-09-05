import OpenAI from "openai";
import { UserAsset, Milestone } from "@shared/schema";

// Initialize the xAI client only if API key is available
let xai: OpenAI | null = null;

// Only create client when API key is available
if (process.env.XAI_API_KEY) {
  xai = new OpenAI({
    baseURL: "https://api.x.ai/v1",
    apiKey: process.env.XAI_API_KEY,
  });
}

/**
 * Generate intelligent milestone suggestions using xAI's Grok API
 */
export async function generateMilestoneSuggestions(
  accounts: UserAsset[],
  totalPortfolioValue: number,
  existingMilestones: Milestone[]
): Promise<
  Array<{
    name: string;
    accountType: string | null;
    targetValue: string;
    description: string;
    icon?: string;
  }>
> {
  try {
    // Only proceed if API key is available and client exists
    if (!process.env.XAI_API_KEY || !xai) {
      console.warn("No xAI API key provided, falling back to local generation");
      return [];
    }

    // Build a detailed prompt for the AI
    const prompt = buildMilestonePrompt(
      accounts,
      totalPortfolioValue,
      existingMilestones
    );

    // Make the API call (we've already checked that xai is not null above)
    const response = await xai!.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content:
            "You are a financial advisor specializing in investment goals and milestone planning. Generate thoughtful and personalized investment milestones based on the user's portfolio.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    // Parse the response
    const messageContent = response.choices[0]?.message.content ?? "{}";
    const result = JSON.parse(messageContent);

    // Validate and format the result
    if (Array.isArray(result.suggestions)) {
      return result.suggestions.slice(0, 5); // Limit to top 5 suggestions
    }

    return [];
  } catch (error) {
    console.error("Error generating AI milestone suggestions:", error);
    return [];
  }
}

/**
 * Build a detailed prompt for the AI based on portfolio data
 */
function buildMilestonePrompt(
  accounts: UserAsset[],
  totalPortfolioValue: number,
  existingMilestones: Milestone[]
): string {
  let accountsSummary = accounts
    .map((acc) => {
      return `- ${acc.providerId} ${acc.accountType} account: £${Number(
        acc.currentValue
      ).toLocaleString()}`;
    })
    .join("\n");

  if (accountsSummary.length === 0) {
    accountsSummary = "No investment accounts yet.";
  }

  let milestonesSummary = existingMilestones
    .map((m) => {
      return `- ${m.name}: £${m.targetValue} ${
        m.accountType ? `(${m.accountType})` : "(Overall portfolio)"
      }`;
    })
    .join("\n");

  if (milestonesSummary.length === 0) {
    milestonesSummary = "No milestones set yet.";
  }

  return `
Please analyze this investment portfolio and suggest 5 personalized milestones:

PORTFOLIO SUMMARY:
Total portfolio value: £${totalPortfolioValue.toLocaleString()}
Number of accounts: ${accounts.length}

ACCOUNTS:
${accountsSummary}

EXISTING MILESTONES:
${milestonesSummary}

Please generate exactly 5 new milestone suggestions as a JSON object with an array of 'suggestions' following this format:
{
  "suggestions": [
    {
      "name": "Brief milestone name",
      "accountType": "ISA or SIPP or LISA or GIA or null for overall portfolio",
      "targetValue": "numeric target as string",
      "description": "Brief description of why this milestone matters",
      "icon": "Single emoji representing this milestone"
    }
  ]
}

Each suggestion should be achievable, specific, motivating, and appropriate for the portfolio composition. Don't repeat existing milestones.
`;
}
