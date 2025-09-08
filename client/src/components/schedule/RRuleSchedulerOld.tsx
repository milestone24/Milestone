import React, { useState, useEffect } from "react";
import { ReactRRuleWidget } from "react-rrule-widget";
import { RRule } from "rrule";

export interface RRuleSchedulerProps {
  value?: string;
  onChange?: (rrule: string) => void;
  className?: string;
}

export const RRuleScheduler: React.FC<RRuleSchedulerProps> = ({
  value = "",
  onChange,
  className = "",
}) => {
  const [rrule, setRrule] = useState(value);
  const [previewDates, setPreviewDates] = useState<Date[]>([]);

  // Update internal state when value prop changes
  useEffect(() => {
    setRrule(value);
  }, [value]);

  const handleChange = (newRRule: string) => {
    setRrule(newRRule);

    // Generate preview dates if RRule is valid
    if (newRRule) {
      try {
        const rruleObj = RRule.fromString(newRRule);
        const dates = rruleObj.all((_, index) => index < 10); // Next 10 occurrences
        setPreviewDates(dates);
      } catch (error) {
        console.warn("Invalid RRule generated:", error);
        setPreviewDates([]);
      }
    } else {
      setPreviewDates([]);
    }

    // Call parent onChange if provided
    onChange?.(newRRule);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <ReactRRuleWidget
        onChange={handleChange}
        value={rrule}
        locale="en"
        config={{
          hideStart: false,
          count: 10,
          endOptions: ["never", "on-date", "after-executions"],
        }}
      />

      {/* Preview of generated dates */}
      {previewDates.length > 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">
            Preview (Next 10 occurrences):
          </h4>
          <ul className="text-sm space-y-1">
            {previewDates.map((date, index) => (
              <li key={index} className="text-muted-foreground">
                {date.toLocaleDateString()} at {date.toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display current RRule string */}
      {rrule && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">Generated RRule:</h4>
          <code className="text-xs text-muted-foreground break-all">
            {rrule}
          </code>
        </div>
      )}
    </div>
  );
};
