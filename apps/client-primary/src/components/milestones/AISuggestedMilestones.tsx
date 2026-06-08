import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, PlusCircle, Key } from "lucide-react";
import { useMilestones } from "@/hooks/use-milestones";
import { useMilestoneCreate } from "@/hooks/use-milestone-create";
import {
  generateMilestoneSuggestions,
  SuggestedMilestone,
} from "@/lib/utils/milestones";
import { useToast } from "@/hooks/use-toast";
import { usePortfolioOverview } from "@/hooks/use-portfolio-overview";
import { createDecimalValueString } from "@milestone/js-common/schema";
import Decimal from "decimal.js";
import { useAssets } from "@/hooks/use-assets";

// Define AccountType directly here as well to avoid type issues
type AccountType = "ISA" | "SIPP" | "LISA" | "GIA";

export default function AISuggestedMilestones() {
  const { milestones, isLoading } = useMilestones();
  const addMilestone = useMilestoneCreate();

  const { data: assets = [], isLoading: isLoadingAssets } = useAssets();

  const { data: portfolioOverview } = usePortfolioOverview();

  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedMilestone[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { toast } = useToast();
  const [needsApiKey, setNeedsApiKey] = useState(false);

  // Generate new suggestions
  const handleGenerateSuggestions = async () => {
    setGeneratingSuggestions(true);
    setNeedsApiKey(false);

    try {
      // Try to use the AI endpoint first
      const response = await fetch("/api/milestones/suggestions/ai");

      if (response.status === 403) {
        // API key is missing
        setNeedsApiKey(true);

        // Fallback to local generation
        const localSuggestions = generateMilestoneSuggestions(
          assets,
          portfolioOverview?.value ? Number(portfolioOverview.value) : 0,
          milestones
        );

        setSuggestions(localSuggestions);
      } else if (response.ok) {
        // We got AI-generated suggestions
        const aiSuggestions = await response.json();
        if (aiSuggestions && aiSuggestions.length > 0) {
          setSuggestions(aiSuggestions);
          toast({
            title: "AI-Generated Milestones",
            description: "Milestones were generated using Grok AI",
            variant: "default",
          });
        } else {
          // Fallback if AI returned empty results
          const localSuggestions = generateMilestoneSuggestions(
            assets,
            portfolioOverview?.value ? Number(portfolioOverview.value) : 0,
            milestones
          );
          setSuggestions(localSuggestions);
        }
      } else {
        // Use local generation as fallback
        const localSuggestions = generateMilestoneSuggestions(
          assets,
          portfolioOverview?.value ? Number(portfolioOverview.value) : 0,
          milestones
        );
        setSuggestions(localSuggestions);
      }

      setShowSuggestions(true);
    } catch (error) {
      console.error("Error generating suggestions:", error);

      // Use local generation as fallback on error
      const localSuggestions = generateMilestoneSuggestions(
        assets,
        portfolioOverview?.value ? Number(portfolioOverview.value) : 0,
        milestones
      );
      setSuggestions(localSuggestions);
      setShowSuggestions(true);
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  // Add a suggested milestone to actual milestones
  const handleAddSuggestion = async (suggestion: SuggestedMilestone) => {
    try {
      // Use type assertion to ensure the type matches what addMilestone expects
      const accountType = suggestion.accountType as AccountType | null;

      await addMilestone.mutateAsync({
        name: suggestion.name,
        accountType: accountType,
        targetValue:
          typeof suggestion.targetValue === "string"
            ? createDecimalValueString(suggestion.targetValue)
            : createDecimalValueString(
                Decimal(suggestion.targetValue).toString()
              ),
      });

      // Remove from suggestions
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            s.name !== suggestion.name ||
            s.targetValue !== suggestion.targetValue ||
            s.accountType !== suggestion.accountType
        )
      );
    } catch (error) {
      console.error("Error adding suggested milestone:", error);
    }
  };

  // Get color based on account type
  const getAccountTypeColor = (type: string | null) => {
    switch (type) {
      case "ISA":
        return "text-blue-400 bg-blue-50";
      case "SIPP":
        return "text-secondary bg-green-50";
      case "LISA":
        return "text-accent bg-amber-50";
      case "GIA":
        return "text-purple-500 bg-purple-50";
      default:
        return "text-primary bg-blue-50";
    }
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Sparkles className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold">AI Suggested Milestones</h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center text-primary border-primary hover:bg-primary hover:text-white"
            onClick={handleGenerateSuggestions}
            disabled={generatingSuggestions || isLoading}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {showSuggestions ? "Refresh Suggestions" : "Generate Suggestions"}
          </Button>
        </div>

        {needsApiKey && (
          // Show message about missing API key
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <Key className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-amber-800">API Key Required</h3>
                <p className="text-sm text-amber-700 mt-1">
                  To use AI-powered milestone suggestions, you need to add an
                  xAI API key. Without it, we'll use our local suggestion
                  system.
                </p>
                <div className="mt-3">
                  <a
                    href="https://x.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-amber-700 mr-3"
                  >
                    Get an API key
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 text-xs border-amber-500 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      // Redirect to settings page where they can add the API key
                      window.location.href = "/settings";
                    }}
                  >
                    Go to Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading || generatingSuggestions ? (
          // Skeleton loading state
          <div className="space-y-3 mt-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-muted rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              ))}
          </div>
        ) : !showSuggestions ? (
          // Prompt to generate suggestions
          <div className="py-6 text-center">
            <p className="text-muted-foreground mb-2">
              Use AI to generate smart milestone suggestions based on your
              portfolio
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Our system analyzes your investments and creates personalized
              goals
            </p>
            <Button
              onClick={handleGenerateSuggestions}
              className="bg-primary text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Milestone Suggestions
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          // No suggestions case
          <div className="py-6 text-center">
            <p className="text-muted-foreground">
              No new milestone suggestions at the moment.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adding more accounts or check back later
            </p>
          </div>
        ) : (
          // Show suggestions
          <div className="space-y-3 mt-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="bg-muted rounded-lg p-4 flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <span className="font-medium mr-2">{suggestion.name}</span>
                    {suggestion.icon && (
                      <span className="text-lg">{suggestion.icon}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1.5">
                    {suggestion.description}
                  </p>
                  <div className="flex items-center">
                    <span
                      className={`text-xs font-medium mr-2 px-2 py-0.5 rounded-full ${getAccountTypeColor(
                        suggestion.accountType
                      )}`}
                    >
                      {suggestion.accountType || "Portfolio"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Target: £{Number(suggestion.targetValue).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => handleAddSuggestion(suggestion)}
                >
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
