import * as React from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "./command";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  className = "",
}) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selected = options.find((opt) => opt.value === value);

  // Keep input value in sync with selected label
  React.useEffect(() => {
    if (!open && selected) {
      setSearch(selected.label);
    }
    if (!open && !selected) {
      setSearch("");
    }
  }, [open, selected]);

  // Filter options by search
  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Open dropdown on focus
  const handleFocus = () => {
    if (!disabled) {
      setOpen(true);
      setSearch(""); // Clear search to show all options
    }
  };

  // Select option
  const handleSelect = (opt: ComboboxOption) => {
    onValueChange(opt.value);
    setSearch(opt.label);
    setOpen(false);
  };

  // Close dropdown on blur (with timeout to allow click)
  const handleBlur = () => {
    setTimeout(() => setOpen(false), 100);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex items-center relative">
        {open && (
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            open && "pl-9",
            disabled && "opacity-70 cursor-not-allowed"
          )}
          value={open ? search : selected?.label || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || loading}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <ChevronDown className="h-4 w-4 opacity-50 absolute right-3 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command className="w-full">
            <CommandList>
              {loading ? (
                <CommandItem disabled>Loading...</CommandItem>
              ) : filtered.length > 0 ? (
                filtered.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onMouseDown={() => handleSelect(opt)}
                    className={cn(
                      value === opt.value && "bg-muted/80 font-medium"
                    )}
                  >
                    {opt.label}
                  </CommandItem>
                ))
              ) : (
                <CommandEmpty>No options found.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
