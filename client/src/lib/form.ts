export const integerInputProps = (field: {
  value: string | number | undefined;
  onChange: (value: string) => void;
}) => ({
  value: field.value !== undefined ? Math.round(Number(field.value)) : "",
  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
    field.onChange(String(Math.round(Number(e.target.value || 0)))),
});

export const decimalInputProps = (
  field: {
    value: string | number | undefined;
    onChange: (value: string) => void;
  },
  options?: { precision?: number }
) => {
  const num = field.value !== undefined ? parseFloat(String(field.value)) : undefined;
  const displayValue = num !== undefined && !isNaN(num) ? num : "";

  if (options?.precision !== undefined) {
    const precision = options.precision;
    return {
      value: displayValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseFloat(e.target.value);
        field.onChange(!isNaN(raw) ? parseFloat(raw.toFixed(precision)).toString() : "");
      },
    };
  }

  return { value: displayValue };
};

export const numberProps = (field: {
  value: number;
  onChange: (value: number) => void;  
}) => {
  const { value, onChange } = field;
  return {
    type: "number",
    value: isNaN(value) || value === null ? 0 : value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
  };
}

export const dateToDateInputValue = (date: Date | undefined | null) => {
  if (!date) return "";
  const format = (date: Date) => {
    return (
      date.getFullYear() +
      "-" +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      date.getDate().toString().padStart(2, "0")
    );
  };
  return format(typeof date === "string" ? new Date(date) : date);
};
