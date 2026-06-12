import * as React from "react";
import AsyncSelect from "react-select/async";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AsyncComboboxOption {
  value: string;
  label: string;
}

interface AsyncComboboxProps {
  options: AsyncComboboxOption[];
  value: string; // selected value (option value)
  onValueChange: (value: string) => void;
  onSearchChange: (search: string) => void;
  searchValue: string; // what the user is typing
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  debounceMs?: number;
}

// Debounce utility
function useDebouncedCallback<T extends (...args: any[]) => void>(
  cb: T,
  delay: number
) {
  const timeout = React.useRef<NodeJS.Timeout | null>(null);
  return React.useCallback(
    (...args: Parameters<T>) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => cb(...args), delay);
    },
    [cb, delay]
  );
}

// New AsyncCombobox using react-select
const AsyncCombobox: React.FC<AsyncComboboxProps> = ({
  options,
  value,
  onValueChange,
  onSearchChange,
  searchValue,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  className = "",
  debounceMs = 300,
}) => {
  // Find the selected option object
  const selectedOption = options.find((opt) => opt.value === value) || null;

  // Debounced search callback
  const debouncedSearch = useDebouncedCallback((input: string) => {
    onSearchChange(input);
  }, debounceMs);

  // react-select expects a promise for async options
  const loadOptions = (
    inputValue: string,
    callback: (opts: AsyncComboboxOption[]) => void
  ) => {
    debouncedSearch(inputValue);
    // react-select expects the callback to be called with options
    callback(options);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <AsyncSelect
        //cacheOptions
        //defaultOptions={options}
        //value={selectedOption}
        isDisabled={disabled}
        isLoading={loading}
        placeholder={placeholder}
        loadOptions={loadOptions}
        // onChange={(opt) => {
        //   if (opt) {
        //     onValueChange((opt as AsyncComboboxOption).value);
        //   }
        // }}
        getOptionLabel={(opt) => opt.label}
        getOptionValue={(opt) => opt.value}
        inputValue={searchValue}
        classNamePrefix="react-select"
        styles={{
          control: (base) => ({
            ...base,
            minHeight: 40,
            borderRadius: 6,
            borderColor: "#e5e7eb",
            boxShadow: "none",
            fontSize: 14,
          }),
          menu: (base) => ({
            ...base,
            zIndex: 50,
          }),
        }}
        components={{
          DropdownIndicator: () => (
            <ChevronDown className="h-4 w-4 opacity-50 mr-2" />
          ),
        }}
      />
    </div>
  );
};

export default AsyncCombobox;
