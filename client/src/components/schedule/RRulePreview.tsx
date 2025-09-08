import React, { useState, useEffect } from "react";
import { RRule } from "rrule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export interface RRulePreviewProps {
  rrule: string;
}

export const RRulePreview: React.FC<RRulePreviewProps> = ({ rrule }) => {
  const [previewDates, setPreviewDates] = useState<Date[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (rrule && showPreview) {
      try {
        const rule = RRule.fromString(rrule);
        const dates = rule.all((_, index) => index < 10); // Next 10 occurrences
        setPreviewDates(dates);
      } catch (error) {
        console.warn("Invalid RRule for preview:", error);
        setPreviewDates([]);
      }
    } else {
      setPreviewDates([]);
    }
  }, [rrule, showPreview]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generated RRule</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center space-x-2"
          >
            {showPreview ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span>{showPreview ? "Hide" : "Show"} Preview</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted rounded-lg">
          <code className="text-sm break-all">
            {rrule || "No RRule generated"}
          </code>
        </div>

        {showPreview && previewDates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Next 10 occurrences:</h4>
            <ul className="space-y-2">
              {previewDates.map((date, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {formatDate(date)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showPreview && previewDates.length === 0 && rrule && (
          <div className="text-sm text-muted-foreground">
            No future occurrences found for this RRule.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
